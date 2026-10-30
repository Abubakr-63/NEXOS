type Service = { ready(): Promise<void>; close(): Promise<void> };
type Host = {
  subscribe(signal: "SIGINT" | "SIGTERM", listener: () => void): () => void;
  exit(code: number): void;
  log(record: { event: string }): void;
};

/** Process supervision only. Deadlines terminate the process, not a running job. */
export function superviseWorker(
  create: (fatal: () => void) => Service,
  host: Host,
  deadlines = { startupMs: 5000, shutdownMs: 10000 },
) {
  let service: Service | undefined;
  let stopping = false;
  let finished = false;
  let code = 0;
  let shutdown: ReturnType<typeof setTimeout> | undefined;
  let startup: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe: (() => void)[] = [];
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(startup);
    clearTimeout(shutdown);
    unsubscribe.forEach((remove) => remove());
    host.exit(code);
  }
  function stop(event?: string) {
    if (finished) return;
    if (event) {
      code = 1;
      host.log({ event });
    }
    if (stopping) return;
    stopping = true;
    clearTimeout(startup);
    shutdown = setTimeout(() => {
      code = 1;
      host.log({ event: "worker.shutdown_timeout" });
      finish();
    }, deadlines.shutdownMs);
    void Promise.resolve()
      .then(() => service?.close())
      .then(finish, () => {
        if (finished) return;
        code = 1;
        host.log({ event: "worker.shutdown_failed" });
        finish();
      });
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    unsubscribe.push(host.subscribe(signal, () => stop()));
  startup = setTimeout(() => stop("worker.start_timeout"), deadlines.startupMs);
  try {
    service = create(() => stop("worker.run_failed"));
    void Promise.resolve()
      .then(() => (stopping ? undefined : service!.ready()))
      .then(
        () => {
          clearTimeout(startup);
          if (!stopping) host.log({ event: "worker.ready" });
        },
        () => {
          if (!stopping) stop("worker.start_failed");
        },
      );
  } catch {
    stop("worker.start_failed");
  }
  return { stop: () => stop() };
}
