import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleTimeline } from "../apps/web/components/pixel/timeline";
import { configurationToScreen } from "../apps/web/components/pixel/adapter";
import { defaultConfiguration } from "../packages/contracts/src";
test("cinematic timeline is finite, clamped, deterministic and reversible at every scene", () => {
  for (const value of [NaN, -1, 0, 0.15, 0.33, 0.5, 0.8, 1, 2]) {
    const frame = sampleTimeline(value);
    assert.ok(
      [...frame.rotation, ...frame.camera, ...frame.target, frame.light].every(
        Number.isFinite,
      ),
    );
    assert.deepEqual(frame, sampleTimeline(value));
  }
  for (let n = 0; n <= 6; n++) assert.equal(sampleTimeline(n / 6).chapter, n);
  assert.deepEqual(sampleTimeline(-1), sampleTimeline(0));
  assert.deepEqual(sampleTimeline(2), sampleTimeline(1));
  assert.notDeepEqual(sampleTimeline(0).rotation, sampleTimeline(1).rotation);
});
test("screen adapter reflects only actual draft values without mutating or inventing build support", () => {
  const input = {
    ...defaultConfiguration,
    name: "My draft",
    darkMode: false,
    accent: "#123456",
    apps: ["files", "calendar", "browser"] as typeof defaultConfiguration.apps,
  };
  const before = JSON.stringify(input);
  const state = configurationToScreen(input);
  assert.equal(state.name, input.name);
  assert.equal(state.dark, false);
  assert.equal(state.accent, input.accent);
  assert.deepEqual(state.apps, ["browser", "calendar", "files"]);
  assert.equal(state.unlocked, false);
  assert.equal(state.draft, true);
  assert.equal("buildEligible" in state, false);
  assert.equal(JSON.stringify(input), before);
});

test("reactive sequences follow only meaningful configuration changes", async () => {
  const { configurationEvent } =
    await import("../apps/web/components/pixel/orchestrator");
  const initial = configurationToScreen({
    ...defaultConfiguration,
    apps: ["browser"],
  });
  assert.equal(
    configurationEvent(initial, { ...initial, name: "Typing a name" }),
    null,
  );
  assert.equal(
    configurationEvent(initial, { ...initial, apps: ["browser", "calendar"] }),
    "calendar-added",
  );
  assert.equal(
    configurationEvent({ ...initial, apps: ["calendar"] }, initial),
    "calendar-removed",
  );
  assert.equal(
    configurationEvent(initial, { ...initial, dark: !initial.dark }),
    "appearance",
  );
  assert.equal(
    configurationEvent(initial, { ...initial, preset: "gaming" }),
    "performance",
  );
});

test("replacing animation clocks cancels stale callbacks and hidden pages pause without accumulating time", async () => {
  const { animationClock } =
    await import("../apps/web/components/pixel/orchestrator");
  const names = [
    "document",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ] as const;
  const originals = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  const fakeDocument = Object.assign(new EventTarget(), { hidden: false });
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    },
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    value: (frame: number) => frames.delete(frame),
  });
  const advance = (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(time));
  };
  let stopFirst = () => {},
    stopLatest = () => {};
  try {
    let obsoleteCalls = 0;
    const latest: number[] = [];
    stopFirst = animationClock(1000, () => obsoleteCalls++);
    advance(100);
    stopFirst();
    stopLatest = animationClock(1000, (elapsed) => latest.push(elapsed));
    advance(116);
    advance(132);
    assert.equal(obsoleteCalls, 1);
    assert.deepEqual(latest, [0, 16]);
    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    assert.equal(frames.size, 0);
    advance(10000);
    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    advance(10016);
    advance(10032);
    assert.deepEqual(latest, [0, 16, 16, 32]);
    stopLatest();
    assert.equal(frames.size, 0);
  } finally {
    stopFirst();
    stopLatest();
    names.forEach((name, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});

test("product film has finite camera paths, real macro scale, separated layers and identical loop endpoints", async () => {
  const { sampleFilm, FILM_DURATION } =
    await import("../apps/web/components/pixel/film");
  assert.equal(FILM_DURATION, 43000);
  for (let n = 0; n <= 430; n++) {
    const shot = sampleFilm(n / 430);
    assert.ok(
      [
        ...shot.camera,
        ...shot.target,
        shot.open,
        shot.light,
        shot.display,
      ].every(Number.isFinite),
    );
    assert.ok(shot.open >= 0 && shot.open <= 1);
    const distance = Math.hypot(
      ...shot.camera.map((v, i) => v - shot.target[i]),
    );
    assert.ok(distance > 3.3, "camera remains outside component surfaces");
  }
  const first = sampleFilm(0),
    last = sampleFilm(1);
  assert.deepEqual(first.camera, last.camera);
  assert.deepEqual(first.target, last.target);
  assert.equal(first.open, last.open);
  assert.ok(Math.abs(first.light - last.light) < 1e-12);
  assert.equal(first.display, last.display);
  assert.ok(
    Math.hypot(
      ...sampleFilm(8 / 43).camera.map(
        (v, i) => v - sampleFilm(8 / 43).target[i],
      ),
    ) < 5,
  );
  assert.equal(sampleFilm(14 / 43).open, 1);
  assert.equal(sampleFilm(34 / 43).display, 1);
  assert.deepEqual(sampleFilm(NaN), first);
});
