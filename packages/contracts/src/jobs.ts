import { z } from "zod";

/** Infrastructure probe only. Deliberately cannot represent an Android compilation. */
export const foundationJobSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("CONNECTIVITY_PROBE"),
    requestId: z.uuid(),
    ownerId: z.uuid(),
  })
  .strict();
export type FoundationJob = z.infer<typeof foundationJobSchema>;
export const probeResultSchema = z
  .object({
    kind: z.literal("CONNECTIVITY_PROBE"),
    compiled: z.literal(false),
    status: z.enum(["checked", "canceled"]),
  })
  .strict();
export type ProbeState =
  "queued" | "running" | "completed" | "failed" | "canceled";
const transitions: Record<ProbeState, readonly ProbeState[]> = {
  queued: ["running", "canceled", "failed"],
  running: ["queued", "completed", "failed", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};
export function canTransitionProbe(from: ProbeState, to: ProbeState) {
  return transitions[from].includes(to);
}
