import { spawn } from "node:child_process";
import {
  lstat,
  realpath,
  mkdir,
  writeFile,
  readFile,
  unlink,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import {
  preflightPlan,
  attemptIdentity,
  type LinuxQualification,
} from "./linux-plan";
import { LIMITS } from "./policy";
import type { Grant } from "./attempt-store";
import type { PreflightTransport } from "./coordinator";

const ROOT = "/var/lib/nexos/executor";
const HOST = "--host=unix:///run/user/10001/docker.sock";

/** Fixed Docker CLI only; never invoke a shell or inherit the worker environment. */
async function docker(
  args: readonly string[],
  home: string,
  signal: AbortSignal,
  timeoutMs: number = LIMITS.cleanupMs,
): Promise<string> {
  if (signal.aborted) throw new Error("Executor command aborted");
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/docker", [...args], {
      cwd: home,
      detached: true,
      shell: false,
      env: {
        PATH: "/usr/bin:/bin",
        HOME: home,
        DOCKER_CONFIG: join(home, "docker-config"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let bytes = 0;
    let failed = false;
    let settled = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    let forced: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (child.pid) {
        try {
          process.kill(-child.pid, signal);
        } catch {}
      }
    };
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(escalation);
      clearTimeout(forced);
      signal.removeEventListener("abort", abort);
      if (ok && !failed) resolve(output);
      else reject(new Error("Isolated executor command failed"));
    };
    const abort = () => {
      if (failed) return;
      failed = true;
      kill("SIGTERM");
      escalation = setTimeout(() => kill("SIGKILL"), 250);
      forced = setTimeout(() => {
        kill("SIGKILL");
        // Persist uncertainty if the control process never acknowledged exit.
        void writeFile(
          join(home, "control-uncertain"),
          "control-exit-unconfirmed",
          { mode: 0o600 },
        ).then(
          () => finish(false),
          () => finish(false),
        );
      }, 1000);
    };
    const timer = setTimeout(abort, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > LIMITS.outputBytes) abort();
      else output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > LIMITS.outputBytes) abort();
    });
    child.once("error", () => finish(false));
    child.once("close", (code) => finish(code === 0));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
async function privateRoot() {
  const stat = await lstat(ROOT);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    stat.uid !== process.getuid!() ||
    (await realpath(ROOT)) !== ROOT
  )
    throw new Error("Private executor root required");
}
/** Not wired to main/API. A separately qualified Linux host/image/reaper is mandatory. */
export async function createLinuxPreflightTransport(
  qualification: LinuxQualification,
): Promise<PreflightTransport> {
  if (process.platform !== "linux" || process.getuid?.() !== 10001)
    throw new Error("LINUX_EXECUTOR_REQUIRED");
  qualification = Object.freeze({ ...qualification });
  await privateRoot();
  // Validate immediately, and again per operation so stale qualifications cannot run.
  preflightPlan(qualification, {
    slot: 0,
    requestId: "",
    attemptId: "00000000-0000-4000-8000-000000000001",
    fence: 1,
    deadline: Date.now() + LIMITS.timeoutMs,
  });
  return {
    async execute(grant, progress, signal) {
      const plan = preflightPlan(qualification, grant);
      await privateRoot();
      const workspace = join(ROOT, grant.attemptId);
      // No recursive mkdir: a reused attempt directory is a recovery condition.
      await mkdir(workspace, { mode: 0o700 });
      await writeFile(
        join(workspace, "attempt"),
        `${grant.attemptId}:${grant.fence}`,
        { flag: "wx", mode: 0o600 },
      );
      await mkdir(join(workspace, "docker-config"), { mode: 0o700 });
      await mkdir(join(workspace, "artifacts-quarantine"), { mode: 0o700 });
      // A lost create/start acknowledgement can leave a pending daemon operation.
      // A new worker must not infer safety from a momentarily empty inventory.
      const pending = join(workspace, "control-pending");
      await writeFile(pending, "create-start-not-acknowledged", {
        flag: "wx",
        mode: 0o600,
      });
      const id = (await docker(plan.args, workspace, signal)).trim();
      if (!/^[a-f0-9]{64}$/.test(id))
        throw new Error("Executor container identity unavailable");
      await progress("ISOLATED");
      await docker([HOST, "start", plan.name], workspace, signal);
      await unlink(pending);
      await progress("PREFLIGHT_RUNNING");
      const exit = (
        await docker(
          [HOST, "wait", plan.name],
          workspace,
          signal,
          LIMITS.timeoutMs,
        )
      ).trim();
      if (exit !== "0") throw new Error("Isolation preflight failed");
      // Exit zero proves only the fixed preflight command returned, never compilation.
    },
    async terminate(grant: Grant) {
      // Identity-only cleanup remains possible after host qualification expires.
      const { name } = attemptIdentity(grant);
      await privateRoot();
      const workspace = join(ROOT, grant.attemptId);
      let exists = true;
      try {
        const stat = await lstat(workspace);
        if (
          !stat.isDirectory() ||
          stat.isSymbolicLink() ||
          (await realpath(workspace)) !== workspace ||
          stat.uid !== process.getuid!() ||
          (stat.mode & 0o077) !== 0
        )
          return false;
        if (
          (await readFile(join(workspace, "attempt"), "utf8")) !==
          `${grant.attemptId}:${grant.fence}`
        )
          return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
        // A missing marker inside an existing directory must not authorize deletion.
        try {
          await lstat(workspace);
          return false;
        } catch {
          exists = false;
        }
      }
      const home = exists ? workspace : ROOT;
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), LIMITS.cleanupMs - 1200);
      try {
        const labels = await docker(
          [HOST, "inspect", "--format", "{{json .Config.Labels}}", name],
          home,
          stop.signal,
        ).then(
          (raw) => JSON.parse(raw) as Record<string, string>,
          () => null,
        );
        if (labels) {
          if (
            labels["nexos.executor"] !== "d4" ||
            labels["nexos.attempt"] !== grant.attemptId ||
            labels["nexos.fence"] !== String(grant.fence)
          )
            return false;
          await docker([HOST, "rm", "--force", name], home, stop.signal);
        }
        // A daemon failure is not interpreted as an absent container.
        const remaining = await docker(
          [
            HOST,
            "container",
            "ls",
            "--all",
            "--filter",
            `name=^${name}$`,
            "--format",
            "{{.Names}}",
          ],
          home,
          stop.signal,
        );
        if (remaining.trim()) return false;
        // Only an independently verified host reconciler may clear these markers.
        for (const marker of ["control-pending", "control-uncertain"]) {
          try {
            await lstat(join(home, marker));
            return false;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
              return false;
          }
        }
        if (exists) {
          // Exact canonical UUID directory and marker were checked, under private root.
          await rm(workspace, { recursive: true, force: false });
        }
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
