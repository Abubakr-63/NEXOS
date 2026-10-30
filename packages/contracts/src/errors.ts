import { z } from "zod";

export const apiErrorMessageSchema = z.union([z.string(), z.array(z.string())]);
// Keep the existing envelope and allow other existing HTTP errors (e.g. 413/415).
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    status: z.number().int(),
    message: apiErrorMessageSchema,
    requestId: z.string(),
  }),
});
export type APIErrorMessage = z.infer<typeof apiErrorMessageSchema>;
export type APIErrorResponse = z.infer<typeof apiErrorSchema>;

function errorAtStatus<S extends number>(status: S) {
  return apiErrorSchema.extend({
    error: apiErrorSchema.shape.error.extend({ status: z.literal(status) }),
  });
}
export const apiErrorsByStatus = {
  400: errorAtStatus(400),
  401: errorAtStatus(401),
  403: errorAtStatus(403),
  404: errorAtStatus(404),
  409: errorAtStatus(409),
  429: errorAtStatus(429),
  500: errorAtStatus(500),
  503: errorAtStatus(503),
} as const;
export type CanonicalErrorStatus = keyof typeof apiErrorsByStatus;

// Mapping/sanitization belongs to the server. This builds the unchanged wire shape
// without reparsing, mutating headers or treating internal exceptions as user input.
export function createAPIError(
  status: number,
  message: APIErrorMessage,
  requestId: string,
): APIErrorResponse {
  return { error: { status, message, requestId } };
}

/** Preserve existing callers' empty-value and array-display rules. No network/retry policy. */
export function formatAPIErrorMessage(
  body: unknown,
  fallback: string,
  policy: "nullish" | "falsy" | "stringified" = "falsy",
): string {
  const error =
    body !== null && typeof body === "object" && "error" in body
      ? body.error
      : undefined;
  const message =
    error !== null && typeof error === "object" && "message" in error
      ? error.message
      : undefined;
  if (policy === "stringified")
    return message == null ? fallback : String(message) || fallback;
  if (Array.isArray(message)) return message.join(". ");
  return String(
    policy === "nullish" ? (message ?? fallback) : message || fallback,
  );
}
