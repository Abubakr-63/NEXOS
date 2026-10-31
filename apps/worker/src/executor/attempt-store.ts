import { randomUUID, createHash } from "node:crypto";
import type { Queue } from "bullmq";
export type HandoffQueue = Queue;
import {
  approvedTarget,
  targetDigest,
  LIMITS,
  progressStages,
  type Progress,
} from "./policy";

export type CheckState =
  | "QUEUED"
  | "PREPARING"
  | "RUNNING"
  | "CHECKED"
  | "FAILED"
  | "CANCELLED"
  | "RECOVERY_REQUIRED";
export type Handle = { slot: number; requestId: string };
export type Grant = Handle & {
  attemptId: string;
  fence: number;
  deadline: number;
};
export type CheckRecord = Handle & {
  ownerId: string;
  revisionId: string;
  digest: string;
  targetDigest: string;
  state: CheckState;
  attemptId: string | null;
  fence: number;
  attempts: number;
  leaseUntil: number;
  deadline: number;
  cancelRequested: boolean;
  stage: number;
  failure: string | null;
  compiled: false;
};
export class HandoffError extends Error {
  constructor(public readonly code: string) {
    super(`Executor handoff ${code}`);
  }
}
// All updates, leases and the global reservation use Redis TIME in one script.
// Retained slots bound state; no TTL/reclamation can silently reuse an identity.
const script = `
local op, owner, slot, req, body = ARGV[1], ARGV[2], ARGV[3], ARGV[4], cjson.decode(ARGV[5])
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
local function save(r) redis.call('HSET', KEYS[1], tostring(r.slot), cjson.encode(r)); return cjson.encode(r) end
local function active(r) return r.state == 'PREPARING' or r.state == 'RUNNING' end
if op == 'admit' then
  local empty = nil
  for i=0,15 do
    local raw = redis.call('HGET', KEYS[1], tostring(i))
    if not raw then if not empty then empty=i end
    else
      local r=cjson.decode(raw)
      if r.ownerId == owner and r.requestId == req then
        if r.digest ~= body.digest then return 'CONFLICT' end
        return cjson.encode(r)
      end
    end
  end
  if empty == nil then return 'CAPACITY' end
  body.slot=empty; body.ownerId=owner; body.requestId=req; body.state='QUEUED'
  body.attemptId=cjson.null; body.fence=0; body.attempts=0; body.leaseUntil=0; body.deadline=0
  body.cancelRequested=false; body.stage=0; body.failure=cjson.null; body.compiled=false
  return save(body)
end
local raw=redis.call('HGET', KEYS[1], slot)
if not raw then return 'NOT_FOUND' end
local r=cjson.decode(raw)
if r.requestId ~= req then return 'NOT_FOUND' end
if op == 'read' or op == 'cancel' then
  if r.ownerId ~= owner then return 'NOT_FOUND' end
  if op == 'cancel' then
    if r.state == 'QUEUED' then r.state='CANCELLED'; r.cancelRequested=true
    elseif active(r) or r.state == 'RECOVERY_REQUIRED' then r.cancelRequested=true end
  end
  return save(r)
end
if op == 'recover' then
  if active(r) and r.leaseUntil <= now then r.state='RECOVERY_REQUIRED'; r.failure='LEASE_EXPIRED' end
  return save(r)
end
if op == 'recovered' then
  if r.state ~= 'RECOVERY_REQUIRED' or r.attemptId ~= body.attemptId or r.fence ~= body.fence then return 'FENCED' end
  if body.cleanupConfirmed ~= true then return 'CLEANUP_REQUIRED' end
  if r.cancelRequested then r.state='CANCELLED'
  elseif r.attempts >= 2 then r.state='FAILED'; r.failure='ATTEMPTS_EXHAUSTED'
  else r.state='QUEUED'; r.failure=cjson.null end
  return save(r)
end
if op == 'quarantine' then
  if not active(r) or r.attemptId ~= body.attemptId or r.fence ~= body.fence then return 'FENCED' end
  r.state='RECOVERY_REQUIRED'; r.failure='CLEANUP_UNCONFIRMED'; return save(r)
end
if op == 'claim' then
  if active(r) and r.leaseUntil <= now then r.state='RECOVERY_REQUIRED'; r.failure='LEASE_EXPIRED'; save(r) end
  if r.state ~= 'QUEUED' then return 'NOT_QUEUED' end
  local all=redis.call('HVALS', KEYS[1])
  for _,item in ipairs(all) do
    local other=cjson.decode(item)
    if active(other) or other.state == 'RECOVERY_REQUIRED' then return 'BUSY' end
  end
  if r.attempts >= 2 then return 'ATTEMPTS_EXHAUSTED' end
  r.attempts=r.attempts+1; r.fence=r.fence+1; r.attemptId=body.attemptId
  r.state='PREPARING'; r.stage=0; r.failure=cjson.null
  r.deadline=now+body.timeoutMs; r.leaseUntil=math.min(now+body.leaseMs,r.deadline)
  return save(r)
end
if not active(r) or r.attemptId ~= body.attemptId or r.fence ~= body.fence or r.leaseUntil <= now then return 'FENCED' end
if op == 'renew' then r.leaseUntil=math.min(now+body.leaseMs,r.deadline+5000)
elseif op == 'progress' then
  if r.deadline <= now then return 'FENCED' end
  if body.stage ~= r.stage+1 or body.stage > 3 then return 'TRANSITION' end
  r.stage=body.stage; if body.stage == 3 then r.state='RUNNING' end
elseif op == 'finish' then
  if body.cleanupConfirmed ~= true then return 'CLEANUP_REQUIRED' end
  if body.state ~= 'CHECKED' and body.state ~= 'FAILED' and body.state ~= 'CANCELLED' then return 'TRANSITION' end
  if body.state == 'CHECKED' and (r.stage ~= 3 or r.deadline <= now) then return 'TRANSITION' end
  r.state=body.state; r.failure=body.failure
  if r.cancelRequested then r.state='CANCELLED'; r.failure=cjson.null end
else return 'INVALID_OPERATION' end
return save(r)
`;
const identifier = (value: string) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new HandoffError("INVALID_ID");
  return value;
};
const states: readonly CheckState[] = [
  "QUEUED",
  "PREPARING",
  "RUNNING",
  "CHECKED",
  "FAILED",
  "CANCELLED",
  "RECOVERY_REQUIRED",
];
function handle(input: Handle) {
  if (
    !Number.isInteger(input.slot) ||
    input.slot < 0 ||
    input.slot >= LIMITS.capacity ||
    !/^[a-f0-9-]{36}$/.test(input.requestId)
  )
    throw new HandoffError("INVALID_ID");
}

/** Internal qualification harness only. No public/API producer or production history. */
export function createTestAttemptStore(
  queue: Queue,
  timings: { leaseMs: number; timeoutMs: number } = LIMITS,
) {
  if (
    process.env.NODE_ENV !== "test" ||
    !/^nexos-test-d4-[a-f0-9]{16}$/.test(queue.opts.prefix ?? "")
  )
    throw new HandoffError("TEST_ISOLATION_REQUIRED");
  if (
    !Number.isInteger(timings.leaseMs) ||
    timings.leaseMs < 50 ||
    timings.leaseMs > LIMITS.leaseMs ||
    !Number.isInteger(timings.timeoutMs) ||
    timings.timeoutMs < timings.leaseMs ||
    timings.timeoutMs > LIMITS.timeoutMs
  )
    throw new HandoffError("INVALID_LIMITS");
  timings = Object.freeze({ ...timings });
  async function command(
    op: string,
    item: Handle,
    owner: string,
    body: object = {},
  ): Promise<CheckRecord> {
    handle(item);
    try {
      const client = await queue.client;
      client.defineCommand("nexosD4Ledger", { numberOfKeys: 1, lua: script });
      const raw = String(
        await client.runCommand("nexosD4Ledger", [
          queue.toKey("d4-ledger"),
          op,
          owner,
          String(item.slot),
          item.requestId,
          JSON.stringify(body),
        ]),
      );
      if (!raw.startsWith("{")) throw new HandoffError(raw);
      const record = JSON.parse(raw) as CheckRecord;
      if (
        record.compiled !== false ||
        !states.includes(record.state) ||
        record.requestId !== item.requestId ||
        !Number.isInteger(record.slot) ||
        record.slot < 0 ||
        record.slot >= LIMITS.capacity ||
        !Number.isInteger(record.attempts) ||
        record.attempts < 0 ||
        record.attempts > LIMITS.attempts ||
        !Number.isInteger(record.fence) ||
        record.fence < 0 ||
        record.fence > LIMITS.attempts ||
        !Number.isInteger(record.stage) ||
        record.stage < 0 ||
        record.stage > 3 ||
        typeof record.cancelRequested !== "boolean" ||
        !Number.isSafeInteger(record.deadline) ||
        !Number.isSafeInteger(record.leaseUntil) ||
        !/^[a-f0-9]{64}$/.test(record.digest) ||
        !/^[a-f0-9]{64}$/.test(record.targetDigest)
      )
        throw new HandoffError("INVALID_STATE");
      return record;
    } catch (error) {
      if (error instanceof HandoffError) throw error;
      throw new HandoffError("UNAVAILABLE");
    }
  }
  return {
    async admit(
      actorId: string,
      raw: unknown,
      authorize: (
        actorId: string,
        revisionId: string,
      ) => Promise<{
        ownerId: string;
        revisionId: string;
        snapshotDigest: string;
        target: unknown;
      } | null>,
    ) {
      identifier(actorId);
      if (
        !raw ||
        typeof raw !== "object" ||
        Object.keys(raw).sort().join() !== "requestId,revisionId"
      )
        throw new HandoffError("INVALID_REQUEST");
      const input = raw as { requestId: string; revisionId: string };
      identifier(input.revisionId);
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          input.requestId,
        )
      )
        throw new HandoffError("INVALID_ID");
      let revision: Awaited<ReturnType<typeof authorize>>;
      try {
        revision = await authorize(actorId, input.revisionId);
      } catch {
        throw new HandoffError("AUTHORITY_UNAVAILABLE");
      }
      if (
        !revision ||
        revision.ownerId !== actorId ||
        revision.revisionId !== input.revisionId
      )
        throw new HandoffError("NOT_FOUND");
      if (!/^[a-f0-9]{64}$/.test(revision.snapshotDigest))
        throw new HandoffError("INVALID_SNAPSHOT");
      const target = approvedTarget(revision.target);
      const digest = createHash("sha256")
        .update(
          JSON.stringify([input.revisionId, revision.snapshotDigest, target]),
        )
        .digest("hex");
      return command(
        "admit",
        { slot: 0, requestId: input.requestId },
        actorId,
        {
          revisionId: input.revisionId,
          digest,
          targetDigest: targetDigest(target),
        },
      );
    },
    read: (actorId: string, item: Handle) =>
      command("read", item, identifier(actorId)),
    cancel: (actorId: string, item: Handle) =>
      command("cancel", item, identifier(actorId)),
    claim: (item: Handle) =>
      command("claim", item, "", { attemptId: randomUUID(), ...timings }),
    renew: (grant: Grant) =>
      command("renew", grant, "", { ...grant, leaseMs: timings.leaseMs }),
    progress: (grant: Grant, stage: Progress) =>
      command("progress", grant, "", {
        ...grant,
        stage: progressStages.indexOf(stage) + 1,
      }),
    finish: (
      grant: Grant,
      state: "CHECKED" | "FAILED" | "CANCELLED",
      cleanupConfirmed: boolean,
      failure: "EXECUTOR_FAILED" | "TIMEOUT" | "CANCELLED" | null = null,
    ) =>
      command("finish", grant, "", {
        ...grant,
        state,
        cleanupConfirmed,
        failure,
      }),
    recover: (item: Handle) => command("recover", item, ""),
    quarantine: (grant: Grant) => command("quarantine", grant, "", grant),
    recovered: (grant: Grant, cleanupConfirmed: boolean) =>
      command("recovered", grant, "", { ...grant, cleanupConfirmed }),
    timings: Object.freeze({ ...timings }),
  };
}
export type AttemptStore = ReturnType<typeof createTestAttemptStore>;
