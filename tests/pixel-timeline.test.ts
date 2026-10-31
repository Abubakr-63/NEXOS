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
      ...sampleFilm(0.8 / 43).camera.map(
        (v, i) => v - sampleFilm(0.8 / 43).target[i],
      ),
    ) < 5,
    "side-frame power key macro shot is closer than 5 units",
  );
  assert.equal(sampleFilm(14 / 43).open, 1);
  assert.equal(sampleFilm(34 / 43).display, 1);
  assert.deepEqual(sampleFilm(NaN), first);

  // Physical power button press & fast screen wake-up verification
  assert.equal(sampleFilm(0).buttonPress, 0);
  assert.equal(sampleFilm(0.8 / 43).buttonPress, 0);
  assert.equal(sampleFilm(0.95 / 43).buttonPress, 1);
  assert.equal(sampleFilm(1.15 / 43).buttonPress, 0);

  assert.equal(sampleFilm(0.8 / 43).display, 0);
  assert.ok(sampleFilm(1.15 / 43).display >= 0.7);
  assert.equal(sampleFilm(1.8 / 43).display, 1);

  // REDMAGIC-inspired floating diagonal product showcase pose verification
  const floating = sampleFilm(8 / 43);
  assert.ok(floating.rotation[1] < -0.3, "front three-quarter yaw profile");
  assert.ok(floating.rotation[0] > 0.1, "upward diagonal tilt pitch");
  assert.ok(floating.rotation[2] < -0.2, "diagonal dynamic roll");
  assert.ok(floating.position[1] > 0, "suspended floating elevation");
});
test("film trajectory strictly locks to front and side profiles: back panel is NEVER visible across dense timeline sampling", async () => {
  const { sampleFilm } = await import("../apps/web/components/pixel/film");
  const { computeFrontDot, MIN_FRONT_DOT } = await import(
    "../apps/web/components/pixel/engine"
  );

  let minDot = 1.0;
  // Dense sampling: 1000 intermediate points across the entire film timeline
  for (let step = 0; step <= 1000; step++) {
    const progress = step / 1000;
    const shot = sampleFilm(progress);

    // Front-facing dot product between device front normal with actual rotation and camera view vector
    const dot = computeFrontDot(shot.rotation, shot.camera, shot.target);
    if (dot < minDot) minDot = dot;

    assert.ok(
      dot >= MIN_FRONT_DOT,
      `Film at progress ${progress.toFixed(3)} has dot product ${dot.toFixed(3)} < MIN_FRONT_DOT (${MIN_FRONT_DOT})`,
    );
    assert.ok(
      shot.camera[2] > 0,
      `Film camera Z must be strictly positive (in front of device), got ${shot.camera[2]}`,
    );
  }

  assert.ok(
    minDot >= 0.85,
    `Film maintains strong front visibility, minimum dot was ${minDot.toFixed(3)}`,
  );
});

test("interactive timeline trajectory strictly locks to front hemisphere: back panel is NEVER visible across all transitions", async () => {
  const { sampleTimeline } = await import("../apps/web/components/pixel/timeline");
  const { computeFrontDot, MIN_FRONT_DOT, MAX_YAW } = await import(
    "../apps/web/components/pixel/engine"
  );

  let minDot = 1.0;
  // Dense sampling across all scenes and transitions
  for (let step = 0; step <= 1000; step++) {
    const progress = step / 1000;
    const shot = sampleTimeline(progress);

    const dot = computeFrontDot(shot.rotation, shot.camera, shot.target);
    if (dot < minDot) minDot = dot;

    assert.ok(
      dot >= MIN_FRONT_DOT,
      `Timeline at progress ${progress.toFixed(3)} has dot product ${dot.toFixed(3)} < MIN_FRONT_DOT (${MIN_FRONT_DOT})`,
    );
    assert.ok(
      Math.abs(shot.rotation[1]) <= MAX_YAW,
      `Device yaw ${shot.rotation[1]} exceeded MAX_YAW ${MAX_YAW}`,
    );
  }

  assert.ok(
    minDot >= 0.85,
    `Timeline maintains strong front visibility, minimum dot was ${minDot.toFixed(3)}`,
  );
});
