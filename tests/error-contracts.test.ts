import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultConfiguration,
  romConfigurationSchema,
  registrationSchema,
  catalogQuerySchema,
  deviceQuerySchema,
  apiErrorSchema,
  apiErrorsByStatus,
  createAPIError,
  formatAPIErrorMessage,
} from "../packages/contracts/src";
import { projectAPI, ProjectAPIError } from "../apps/web/lib/project-api";

test("canonical status schemas retain the existing envelope, string/array messages and ancillary HTTP errors", () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500, 503] as const) {
    for (const message of ["Existing public message", ["name: Required"]]) {
      const body = createAPIError(status, message, "req-fixed");
      assert.deepEqual(body, {
        error: { status, message, requestId: "req-fixed" },
      });
      assert.deepEqual(apiErrorsByStatus[status].parse(body), body);
      assert.equal(
        apiErrorsByStatus[status].safeParse({
          ...body,
          error: { ...body.error, status: 418 },
        }).success,
        false,
      );
    }
  }
  assert.equal(
    apiErrorSchema.safeParse(
      createAPIError(413, "Payload Too Large", "req-fixed"),
    ).success,
    true,
  );
  assert.equal(
    apiErrorSchema.safeParse({
      error: { status: 500, message: "Safe", requestId: "r", stack: "hidden" },
    }).success,
    false,
  );
});

test("shared error formatter preserves all three existing display policies and native-error fallbacks", () => {
  for (const [message, sentences, project, studio] of [
    [
      "Session expired",
      "Session expired",
      "Session expired",
      "Session expired",
    ],
    [
      ["name: Required", "revision: Required"],
      "name: Required. revision: Required",
      "name: Required. revision: Required",
      "name: Required,revision: Required",
    ],
    [[], "", "", "fallback"],
    ["", "", "fallback", "fallback"],
    [null, "fallback", "fallback", "fallback"],
    [undefined, "fallback", "fallback", "fallback"],
    [0, "0", "fallback", "0"],
    [false, "false", "fallback", "false"],
  ] as const) {
    const body = { error: { message } };
    assert.equal(formatAPIErrorMessage(body, "fallback", "nullish"), sentences);
    assert.equal(formatAPIErrorMessage(body, "fallback", "falsy"), project);
    assert.equal(
      formatAPIErrorMessage(body, "fallback", "stringified"),
      studio,
    );
  }
  for (const body of [
    null,
    undefined,
    {},
    { error: "Bad Request", message: "native router message", statusCode: 400 },
  ])
    assert.equal(formatAPIErrorMessage(body, "fallback"), "fallback");
});

test("project client preserves statuses/messages, cancellation, writes and success JSON without automatic retries", async (context) => {
  let calls = 0;
  let response: Response;
  let failure: Error | undefined;
  const fetch = context.mock.method(
    globalThis,
    "fetch",
    async (
      _url: Parameters<typeof globalThis.fetch>[0],
      _options?: RequestInit,
    ) => {
      calls++;
      if (failure) throw failure;
      return response;
    },
  );
  for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
    response = new Response(
      JSON.stringify(createAPIError(status, "Existing message", "r")),
      { status, headers: { "Retry-After": "7" } },
    );
    const before = calls;
    await assert.rejects(
      projectAPI("projects/id", "PATCH", { revision: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof ProjectAPIError);
        assert.equal(error.status, status);
        assert.equal(error.message, "Existing message");
        return true;
      },
    );
    assert.equal(calls, before + 1);
    const options = fetch.mock.calls.at(-1)?.arguments[1];
    assert.equal(options?.method, "PATCH");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.body, JSON.stringify({ revision: 1 }));
  }
  const success = {
    id: "opaque",
    revision: 2,
    configuration: { description: "" },
  };
  response = new Response(JSON.stringify(success), { status: 200 });
  assert.deepEqual(await projectAPI("projects/id"), success);
  response = new Response("invalid-json", { status: 503 });
  await assert.rejects(projectAPI("projects"), {
    message:
      "The API is unavailable. Check the NestJS API, DATABASE_URL and PostgreSQL connection.",
  });
  failure = new DOMException("Aborted", "AbortError");
  await assert.rejects(projectAPI("projects"), (error) => error === failure);
  failure = new Error("network failure");
  await assert.rejects(projectAPI("projects"), {
    message: "Cannot reach the API. Start the NestJS API and check API_ORIGIN.",
    status: 0,
  });
});

test("NUL search input is rejected by both shared queries without altering valid search defaults", () => {
  for (const schema of [catalogQuerySchema, deviceQuerySchema]) {
    assert.deepEqual(schema.parse({ q: "  pixel  " }), {
      q: "pixel",
      page: 1,
      limit: 12,
    });
    for (const q of ["\u0000", "prefix\u0000suffix"]) {
      const result = schema.safeParse({ q });
      assert.equal(result.success, false);
      if (!result.success)
        assert.deepEqual(
          result.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
          [{ path: ["q"], message: "Invalid search query" }],
        );
    }
  }
});

test("configuration rejects only proven unstorable NUL fields, without a blanket password restriction", () => {
  for (const field of ["name", "description", "variantId", "base"]) {
    assert.equal(
      romConfigurationSchema.safeParse({
        ...defaultConfiguration,
        [field]: "prefix\u0000suffix",
      }).success,
      false,
    );
  }
  assert.equal(
    registrationSchema.safeParse({
      email: "synthetic@example.com",
      username: "synthetic",
      password: "synthetic\u0000passphrase",
    }).success,
    true,
  );
});
