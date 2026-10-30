import { LIMITS, approvedTarget, CUTTLEFISH } from "./policy";
import type { Grant } from "./attempt-store";

export type LinuxQualification = {
  kind: "LINUX_PREFLIGHT_V1";
  qualifiedAt: string;
  image: string;
  cgroupV2: true;
  rootless: true;
  resourceEnforcementVerified: true;
  externalReaperVerified: true;
};
const fields =
  "cgroupV2,externalReaperVerified,image,kind,qualifiedAt,resourceEnforcementVerified,rootless";
export function attemptIdentity(grant: Grant) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      grant.attemptId,
    ) ||
    !Number.isSafeInteger(grant.fence) ||
    grant.fence < 1
  )
    throw new Error("Invalid executor attempt identity");
  return { name: `nexos-d4-${grant.attemptId}` };
}
/** Operator qualification is not accepted from jobs/API input. No default usable image. */
export function preflightPlan(
  rawQualification: unknown,
  grant: Grant,
  target: unknown = CUTTLEFISH,
  now = new Date(),
) {
  approvedTarget(target);
  const { name } = attemptIdentity(grant);
  const q = rawQualification as LinuxQualification;
  if (
    !q ||
    Object.keys(q).sort().join() !== fields ||
    q.kind !== "LINUX_PREFLIGHT_V1" ||
    q.cgroupV2 !== true ||
    q.rootless !== true ||
    q.resourceEnforcementVerified !== true ||
    q.externalReaperVerified !== true ||
    !/^nexos\/isolation-preflight@sha256:[a-f0-9]{64}$/.test(q.image)
  )
    throw new Error("Executor qualification unavailable");
  const age = now.getTime() - Date.parse(q.qualifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > 86400000)
    throw new Error("Executor qualification expired");
  if (
    !Number.isSafeInteger(grant.deadline) ||
    grant.deadline <= now.getTime() ||
    grant.deadline > now.getTime() + LIMITS.timeoutMs
  )
    throw new Error("Invalid executor deadline");
  const deadline = new Date(grant.deadline).toISOString();
  return Object.freeze({
    kind: "ISOLATION_PREFLIGHT" as const,
    compiled: false as const,
    name,
    executable: "/usr/bin/docker" as const,
    args: Object.freeze([
      "--host=unix:///run/user/10001/docker.sock",
      "create",
      "--pull=never",
      `--name=${name}`,
      "--label=nexos.executor=d4",
      `--label=nexos.attempt=${grant.attemptId}`,
      `--label=nexos.fence=${grant.fence}`,
      `--label=nexos.deadline=${deadline}`,
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges=true",
      "--user=10001:10001",
      "--init",
      "--cpus=1",
      "--memory=512m",
      "--memory-swap=512m",
      "--pids-limit=64",
      "--ulimit=nofile=256:256",
      "--ipc=private",
      "--shm-size=16m",
      "--log-driver=none",
      "--tmpfs=/work:rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700",
      "--tmpfs=/artifacts:rw,noexec,nosuid,nodev,size=16m,uid=10001,gid=10001,mode=0700",
      "--workdir=/work",
      "--entrypoint=/usr/local/bin/nexos-preflight",
      q.image,
    ]),
  });
}
