import { createFoundationWorker } from "./foundation";
import { superviseWorker } from "./runtime";

const log = (record: { event: string }) =>
  console.error(JSON.stringify(record));

superviseWorker(
  (onFatal) =>
    createFoundationWorker(process.env.REDIS_URL ?? "redis://localhost:6379", {
      log,
      onFatal,
    }),
  {
    log,
    exit: (code) => process.exit(code),
    subscribe(signal, listener) {
      process.on(signal, listener);
      return () => {
        process.off(signal, listener);
      };
    },
  },
);
