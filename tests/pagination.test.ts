import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { BadRequestException } from "../apps/api/node_modules/@nestjs/common";
import {
  page,
  readCursor,
  timeBoundary,
  revisionBoundary,
} from "../apps/api/src/pagination";
import {
  projectListQuerySchema,
  sessionListQuerySchema,
  revisionListQuerySchema,
  auditListQuerySchema,
} from "../packages/contracts/src";

function fixtureKey(context: { after: (fn: () => void) => void }) {
  const previous = process.env.AUTH_ACCOUNT_HMAC_KEY;
  process.env.AUTH_ACCOUNT_HMAC_KEY = randomBytes(32).toString("hex");
  context.after(() => {
    if (previous === undefined) delete process.env.AUTH_ACCOUNT_HMAC_KEY;
    else process.env.AUTH_ACCOUNT_HMAC_KEY = previous;
  });
}
test("cursor query opt-in is bounded, strips unknowns, and preserves ignored legacy queries", () => {
  for (const schema of [
    projectListQuerySchema,
    sessionListQuerySchema,
    revisionListQuerySchema,
    auditListQuerySchema,
  ]) {
    assert.deepEqual(
      schema.parse({ limit: "invalid", cursor: "invalid", sort: "other" }),
      {},
    );
    assert.equal(schema.parse({ pagination: "cursor" }).pagination, "cursor");
    assert.equal(
      schema.parse({ pagination: "cursor", limit: " 2 ", unknown: "ignored" })
        .pagination,
      "cursor",
    );
    for (const limit of [
      "",
      "0",
      "-1",
      "1.2",
      "1e2",
      "0x10",
      "999999",
      ["2", "3"],
      "\u0000",
    ])
      assert.equal(
        schema.safeParse({ pagination: "cursor", limit }).success,
        false,
      );
    for (const cursor of ["", "v1.!!!", "x".repeat(2049), ["v1.abc", "v1.def"]])
      assert.equal(
        schema.safeParse({ pagination: "cursor", cursor }).success,
        false,
      );
    assert.equal(schema.safeParse({ pagination: "offset" }).success, false);
  }
  assert.equal(
    projectListQuerySchema.safeParse({ pagination: "cursor", limit: "100" })
      .success,
    true,
  );
  assert.equal(
    sessionListQuerySchema.safeParse({ pagination: "cursor", limit: "101" })
      .success,
    false,
  );
  assert.equal(
    revisionListQuerySchema.safeParse({ pagination: "cursor", limit: "51" })
      .success,
    false,
  );
  assert.equal(
    auditListQuerySchema.safeParse({ pagination: "cursor", limit: "51" })
      .success,
    false,
  );
});

test("opaque cursors authenticate scope, hide identifiers, expire, and never renew traversal lifetime", (context) => {
  fixtureKey(context);
  const clock = context.mock.method(Date, "now", () => 1000000);
  const rows = [
    {
      id: "sensitive-internal-identifier-z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    { id: "second", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const first = page(
    rows,
    1,
    "projects:private-owner",
    undefined,
    (row) => row,
  );
  assert.equal(first.pagination.hasMore, true);
  const token = first.pagination.nextCursor!;
  assert.equal(token.includes("private-owner"), false);
  assert.equal(
    Buffer.from(token.slice(3), "base64url")
      .toString("utf8")
      .includes(rows[0].id),
    false,
  );
  const decoded = readCursor(token, "projects:private-owner");
  assert.ok(decoded);
  assert.deepEqual(decoded.position, rows[0]);
  assert.throws(
    () => readCursor(token, "projects:another-owner"),
    BadRequestException,
  );
  assert.throws(
    () => readCursor(token, "sessions:private-owner"),
    BadRequestException,
  );
  const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  for (const invalid of [
    tampered,
    "v1.abc",
    "v1." + "A".repeat(2048),
    token + "=",
  ])
    assert.throws(
      () => readCursor(invalid, "projects:private-owner"),
      BadRequestException,
    );
  clock.mock.mockImplementation(() => 1000000 + 600000);
  const second = page(rows, 1, "projects:private-owner", decoded, (row) => row);
  assert.equal(
    readCursor(second.pagination.nextCursor!, "projects:private-owner")
      ?.expiresAt,
    decoded.expiresAt,
  );
  clock.mock.mockImplementation(() => decoded.expiresAt);
  assert.throws(
    () => readCursor(token, "projects:private-owner"),
    BadRequestException,
  );
});

test("empty/final pages and seek boundaries are explicit and independent of anchor row existence", (context) => {
  fixtureKey(context);
  assert.deepEqual(
    page([], 2, "scope", undefined, () => ({ id: "unused", number: 1 })),
    { items: [], pagination: { limit: 2, hasMore: false, nextCursor: null } },
  );
  const result = page(
    [
      { id: "z", number: 3 },
      { id: "y", number: 2 },
    ],
    1,
    "scope",
    undefined,
    (row) => row,
  );
  const cursor = readCursor(result.pagination.nextCursor!, "scope");
  assert.deepEqual(revisionBoundary(cursor), {
    OR: [{ number: { lt: 3 } }, { number: 3, id: { lt: "z" } }],
  });
  assert.throws(() => timeBoundary(cursor), BadRequestException);
  assert.throws(
    () =>
      page(
        [
          { id: "x".repeat(4000), number: 2 },
          { id: "y", number: 1 },
        ],
        1,
        "scope",
        undefined,
        (row) => row,
      ),
    { message: "Pagination cursor unavailable" },
  );
  const final = page(
    [{ id: "y", number: 2 }],
    1,
    "scope",
    cursor,
    (row) => row,
  );
  assert.deepEqual(final.pagination, {
    limit: 1,
    hasMore: false,
    nextCursor: null,
  });
});

test("missing cursor key is an infrastructure error rather than a forged-client-input error", (context) => {
  fixtureKey(context);
  const token = page(
    [
      { id: "z", number: 2 },
      { id: "y", number: 1 },
    ],
    1,
    "scope",
    undefined,
    (row) => row,
  ).pagination.nextCursor!;
  delete process.env.AUTH_ACCOUNT_HMAC_KEY;
  assert.throws(
    () => readCursor(token, "scope"),
    (error) =>
      error instanceof Error && !(error instanceof BadRequestException),
  );
});
