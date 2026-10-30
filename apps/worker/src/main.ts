import { createFoundationWorker } from "./foundation";

const log = (record: { event: string }) =>
  console.error(JSON.stringify(record));
async function main() {
  const service = createFoundationWorker(
    process.env.REDIS_URL ?? "redis://localhost:6379",
    { log },
  );
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      // Infrastructure probes have no external side effects. A stuck process is terminated;
      // BullMQ's renewable lock/stalled recovery handles unacknowledged work on restart.
      const deadline = setTimeout(() => process.exit(1), 10000);
      service.close().then(
        () => {
          clearTimeout(deadline);
          process.exit(0);
        },
        () => {
          log({ event: "worker.shutdown_failed" });
          process.exit(1);
        },
      );
    });
  const startup = setTimeout(() => {
    log({ event: "worker.start_timeout" });
    process.exit(1);
  }, 5000);
  try {
    await service.ready();
  } finally {
    clearTimeout(startup);
  }
}
main().catch(() => {
  log({ event: "worker.start_failed" });
  process.exit(1);
});
