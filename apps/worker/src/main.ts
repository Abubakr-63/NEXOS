import { Worker } from "bullmq";
// Foundation queue: accepts connectivity probes only. Unimplemented security jobs fail closed.
const redis = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const worker = new Worker(
  "romhub-foundation",
  async (job) => {
    if (job.name !== "healthcheck")
      throw new Error(
        "Unsupported job; artifact verification is not implemented",
      );
    return { status: "ok" };
  },
  {
    connection: {
      host: redis.hostname,
      port: Number(redis.port || 6379),
      username: redis.username || undefined,
      password: redis.password || undefined,
      ...(redis.protocol === "rediss:" ? { tls: {} } : {}),
    },
    concurrency: 2,
  },
);
worker.on("failed", (job, error) =>
  console.error(
    JSON.stringify({
      event: "job.failed",
      id: job?.id,
      message: error.message,
    }),
  ),
);
worker.on("error", (error) =>
  console.error(
    JSON.stringify({ event: "worker.error", message: error.message }),
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await worker.close();
    process.exit(0);
  });
