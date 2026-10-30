import { LIMITS, type Progress } from "./policy";
import {
  type AttemptStore,
  type Handle,
  type Grant,
  type CheckRecord,
  HandoffError,
} from "./attempt-store";

export interface PreflightTransport {
  execute(
    grant: Grant,
    progress: (stage: Progress) => Promise<void>,
    signal: AbortSignal,
  ): Promise<void>;
  /** True only after the exact attempt's container/process tree is absent. */
  terminate(grant: Grant): Promise<boolean>;
}
function grantFor(record: CheckRecord): Grant {
  if (!record.attemptId) throw new HandoffError("NO_ATTEMPT");
  return {
    slot: record.slot,
    requestId: record.requestId,
    attemptId: record.attemptId,
    fence: record.fence,
    deadline: record.deadline,
  };
}
async function cleanup(
  transport: PreflightTransport,
  grant: Grant,
  timeoutMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => transport.terminate(grant)),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
/** No queue acknowledgement is execution authority. Redis grant/fence remains mandatory. */
export async function runPreflight(
  store: AttemptStore,
  item: Handle,
  transport: PreflightTransport,
  options: {
    signal?: AbortSignal;
    progress?: (record: {
      kind: "ISOLATION_PREFLIGHT";
      compiled: false;
      stage: Progress;
      fence: number;
    }) => void;
    cleanupMs?: number;
  } = {},
) {
  if (
    options.cleanupMs !== undefined &&
    (process.env.NODE_ENV !== "test" ||
      !Number.isInteger(options.cleanupMs) ||
      options.cleanupMs < 10 ||
      options.cleanupMs > LIMITS.cleanupMs)
  )
    throw new HandoffError("INVALID_LIMITS");
  const record = await store.claim(item);
  const grant = grantFor(record);
  const controller = new AbortController();
  const outcome: { failure: "TIMEOUT" | "CANCELLED" | "EXECUTOR_FAILED" } = {
    failure: "EXECUTOR_FAILED",
  };
  const cancel = () => {
    outcome.failure = "CANCELLED";
    controller.abort();
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const deadline = setTimeout(() => {
    outcome.failure = "TIMEOUT";
    controller.abort();
  }, store.timings.timeoutMs);
  let renewing = false;
  const heartbeat = setInterval(
    () => {
      if (renewing) return;
      renewing = true;
      void store
        .renew(grant)
        .then(
          (current) => {
            if (current.cancelRequested) cancel();
          },
          () => {
            controller.abort();
          },
        )
        .finally(() => {
          renewing = false;
        });
    },
    Math.max(10, Math.floor(store.timings.leaseMs / 3)),
  );
  let abortListener: (() => void) | undefined;
  try {
    const progress = async (stage: Progress) => {
      if (controller.signal.aborted) throw new HandoffError("ABORTED");
      await store.progress(grant, stage);
      options.progress?.({
        kind: "ISOLATION_PREFLIGHT",
        compiled: false,
        stage,
        fence: grant.fence,
      });
    };
    const stopped = new Promise<never>((_, reject) => {
      abortListener = () => reject(new HandoffError("ABORTED"));
      controller.signal.addEventListener("abort", abortListener, {
        once: true,
      });
      if (controller.signal.aborted) abortListener();
    });
    const work = Promise.resolve().then(async () => {
      await progress("ALLOCATED");
      await transport.execute(grant, progress, controller.signal);
    });
    let checked = false;
    try {
      await Promise.race([work, stopped]);
      checked = true;
    } catch {
      controller.abort();
    }
    // Never release a reservation merely because Promise.race or a timeout returned.
    const confirmed = await cleanup(
      transport,
      grant,
      options.cleanupMs ?? LIMITS.cleanupMs,
    );
    if (!confirmed) {
      await store.quarantine(grant).catch(() => undefined);
      return {
        kind: "ISOLATION_PREFLIGHT" as const,
        compiled: false as const,
        state: "RECOVERY_REQUIRED" as const,
        cleanupConfirmed: false,
      };
    }
    try {
      const final = await store.finish(
        grant,
        checked && !controller.signal.aborted
          ? "CHECKED"
          : outcome.failure === "CANCELLED"
            ? "CANCELLED"
            : "FAILED",
        true,
        checked ? null : outcome.failure,
      );
      return {
        kind: "ISOLATION_PREFLIGHT" as const,
        compiled: false as const,
        state: final.state,
        cleanupConfirmed: true,
      };
    } catch {
      // Lease loss can never become success, even after successful local cleanup.
      return {
        kind: "ISOLATION_PREFLIGHT" as const,
        compiled: false as const,
        state: "RECOVERY_REQUIRED" as const,
        cleanupConfirmed: true,
      };
    }
  } finally {
    controller.abort();
    clearTimeout(deadline);
    clearInterval(heartbeat);
    options.signal?.removeEventListener("abort", cancel);
    if (abortListener)
      controller.signal.removeEventListener("abort", abortListener);
  }
}
export async function recoverPreflight(
  store: AttemptStore,
  item: Handle,
  transport: PreflightTransport,
) {
  const record = await store.recover(item);
  if (record.state !== "RECOVERY_REQUIRED")
    throw new HandoffError("RECOVERY_NOT_READY");
  const grant = grantFor(record);
  if (!(await cleanup(transport, grant, LIMITS.cleanupMs)))
    throw new HandoffError("CLEANUP_REQUIRED");
  return store.recovered(grant, true);
}
