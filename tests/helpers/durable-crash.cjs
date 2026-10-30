// Real BullMQ consumer/PG attempt, controlled preflight transport, no compiler.
if (
  process.env.NODE_ENV !== "test" ||
  !/^\/nexos_d5_test_[a-f0-9]{8}$/.test(
    new URL(process.env.DATABASE_URL).pathname,
  )
)
  throw new Error("Disposable test DB required");
const {
  DurableJobs,
  PrismaClient,
} = require("../../apps/worker/dist/durable/jobs.js");
const {
  createDurableQueue,
  createDurableWorker,
} = require("../../apps/worker/dist/durable/queue.js");
const db = new PrismaClient();
const jobs = new DurableJobs(db);
const broker = createDurableQueue(process.env.REDIS_URL, process.argv[2]);
const worker = createDurableWorker(
  broker,
  jobs,
  {
    execute: async (grant) => {
      process.send({ attemptId: grant.attemptId, fence: grant.fence });
      await new Promise(() => {});
    },
    terminate: async () => true,
  },
  undefined,
  undefined,
  { lockDuration: 500, stalledInterval: 500 },
);
worker.ready().then(
  () => process.send({ ready: true }),
  () => {
    process.send({ error: true });
    process.exit(1);
  },
);
