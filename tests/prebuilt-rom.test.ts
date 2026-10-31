import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import {
  PREBUILT_ID,
  PREBUILT_SELECTION,
  localDemoRequest,
  supportedSelection,
  PrebuiltRomStore,
} from "../apps/api/src/prebuilt-rom";

test("prebuilt selection is exact and rejects paths, unsupported variants and extra input", () => {
  supportedSelection(PREBUILT_ID, PREBUILT_SELECTION);
  for (const [id, query] of [
    ["../secret", PREBUILT_SELECTION],
    [PREBUILT_ID, { ...PREBUILT_SELECTION, codename: "mojito" }],
    [PREBUILT_ID, { ...PREBUILT_SELECTION, device: "redmi-note-10-5g" }],
    [PREBUILT_ID, { ...PREBUILT_SELECTION, path: "C:/secret" }],
    [PREBUILT_ID, {}],
  ])
    assert.throws(() => supportedSelection(id as string, query));
});
test("prebuilt demo fails closed in production, without opt-in, across networks and behind proxies", () => {
  const old = process.env.NODE_ENV,
    flag = process.env.NEXOS_LOCAL_PREBUILT_DEMO,
    origin = process.env.WEB_ORIGIN;
  try {
    process.env.NODE_ENV = "development";
    process.env.NEXOS_LOCAL_PREBUILT_DEMO = "1";
    process.env.WEB_ORIGIN = "http://localhost:3000";
    localDemoRequest("127.0.0.1", undefined, "same-site");
    assert.throws(() => localDemoRequest("192.168.1.1", undefined, "none"));
    assert.throws(() =>
      localDemoRequest("127.0.0.1", "https://bad.invalid", "cross-site"),
    );
    assert.throws(() =>
      localDemoRequest("127.0.0.1", undefined, "same-site", true),
    );
    process.env.NODE_ENV = "production";
    assert.throws(() => localDemoRequest("127.0.0.1", undefined, "none"));
    process.env.NODE_ENV = "development";
    delete process.env.NEXOS_LOCAL_PREBUILT_DEMO;
    assert.throws(() => localDemoRequest("127.0.0.1", undefined, "none"));
  } finally {
    for (const [k, v] of Object.entries({
      NODE_ENV: old,
      NEXOS_LOCAL_PREBUILT_DEMO: flag,
      WEB_ORIGIN: origin,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
test("artifact uses verified open-file bytes; missing and changed files fail safely", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexos-prebuilt-"));
  const file = join(dir, "artifact.zip");
  const bytes = Buffer.from("small verification fixture");
  try {
    await writeFile(file, bytes);
    const store = new PrebuiltRomStore(
      file,
      bytes.length,
      createHash("sha256").update(bytes).digest("hex"),
    );
    const opened = await store.download();
    const chunks = [];
    for await (const chunk of opened.file.createReadStream({
      start: 0,
      autoClose: true,
    }))
      chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), bytes);
    await writeFile(file, Buffer.alloc(bytes.length, 1));
    await assert.rejects(store.download(), /integrity/);
    await assert.rejects(
      new PrebuiltRomStore(join(dir, "absent")).download(),
      /unavailable/,
    );
  } finally {
    const bounded = relative(resolve(tmpdir()), resolve(dir));
    assert(
      !isAbsolute(bounded) &&
        !bounded.startsWith("..") &&
        bounded.startsWith("nexos-prebuilt-"),
    );
    await rm(dir, { recursive: true });
  }
});
