export const FILM_DURATION = 43000;
export const filmScenes = [
  {
    title: "Device reveal",
    label: "Designed from the inside out.",
    detail:
      "An original NEXOS concept device. Precision titanium frame and considered detail.",
  },
  {
    title: "Side-frame macro",
    label: "A closer kind of clarity.",
    detail:
      "Machined tactile controls and curved 2.5D front glass, rendered as real geometry.",
  },
  {
    title: "Front architecture",
    label: "Beneath the surface.",
    detail:
      "Layered OLED architecture and front chassis engineering in balanced perspective.",
  },
  {
    title: "Configuration intent",
    label: "Precision, in every choice.",
    detail:
      "Visualizing configuration preferences across the dynamic front interface.",
  },
  {
    title: "Screen illumination",
    label: "Form. Flow. Focus.",
    detail:
      "A refined front study with responsive lighting and glass reflections.",
  },
  {
    title: "NEXOS Android",
    label: "A screen that becomes yours.",
    detail:
      "Animated themes, applications and Calendar in an original interface concept. Not a running Android OS.",
  },
  {
    title: "Final hero reveal",
    label: "Your phone. Your Android. Your rules.",
    detail:
      "Your ideas, expressed as a configuration draft in a pure front product showcase.",
  },
] as const;

type Vector = [number, number, number];
type Key = {
  t: number;
  camera: Vector;
  target: Vector;
  open: number;
  light: number;
  display: number;
  screen: number;
};

/**
 * Strict Front & Side Camera Paths:
 * Rear hemisphere is completely forbidden. All camera positions remain strictly in front (Z >= 4.2).
 * Dot product with device front normal is >= 0.91 across all 43 seconds.
 */
const keys: Key[] = [
  // Scene 0: Device reveal (Front three-quarter hero angle)
  {
    t: 0,
    camera: [8, 3.5, 32],
    target: [0, 0.2, 0],
    open: 0,
    light: 0.85,
    display: 0,
    screen: 0,
  },
  {
    t: 3,
    camera: [5, 2.0, 31],
    target: [0, 0.3, 0],
    open: 0,
    light: 1.0,
    display: 0,
    screen: 0,
  },
  // Scene 1: Side-frame & Front glass macro shot (t = 6 to 9)
  // Distance at t=8s is ~4.03 (< 5 required for macro scale)
  {
    t: 6,
    camera: [3.2, 2.85, 4.8],
    target: [2.5, 2.85, 0.4],
    open: 0,
    light: 1.0,
    display: 0,
    screen: 0,
  },
  {
    t: 8,
    camera: [3.1, 2.85, 4.4],
    target: [2.6, 2.85, 0.4],
    open: 0,
    light: 0.95,
    display: 0,
    screen: 0,
  },
  // Scene 2: Front Layered Architecture & Technical Cutaway (t = 10 to 17)
  // Open reaches 1.0 at t=14s
  {
    t: 10,
    camera: [-2.8, 3.8, 8.5],
    target: [-0.3, 1.2, 0.4],
    open: 1,
    light: 1.0,
    display: 0,
    screen: 0,
  },
  {
    t: 14,
    camera: [-2.2, 2.5, 7.8],
    target: [-0.2, 1.0, 0.4],
    open: 1,
    light: 1.0,
    display: 0,
    screen: 0,
  },
  {
    t: 17,
    camera: [2.5, 2.2, 8.2],
    target: [0.2, 1.8, 0.4],
    open: 1,
    light: 1.15,
    display: 0,
    screen: 0,
  },
  // Scene 3: Configuration Intent & Front Chassis Sweep (t = 17 to 21)
  {
    t: 21,
    camera: [-2.5, -0.4, 9.5],
    target: [0.2, -1.0, 0.4],
    open: 1,
    light: 0.95,
    display: 0,
    screen: 0,
  },
  // Scene 4: Screen Illumination & Tactile Rail Focus (t = 21 to 29)
  {
    t: 25,
    camera: [3.2, -1.8, 9.2],
    target: [0.3, -1.2, 0.4],
    open: 1,
    light: 1.1,
    display: 0.1,
    screen: 0,
  },
  {
    t: 28,
    camera: [1.2, -0.8, 14.0],
    target: [0, -0.3, 0.2],
    open: 0.8,
    light: 1.0,
    display: 0.3,
    screen: 0,
  },
  // Scene 5: NEXOS Android UI & Screen Takeover (t = 29 to 36)
  // Display reaches 1.0 at t=34s
  {
    t: 30,
    camera: [0, 0.4, 28],
    target: [0, 0.2, 0],
    open: 0,
    light: 1.0,
    display: 0.6,
    screen: 0,
  },
  {
    t: 32,
    camera: [1.5, 0.2, 29],
    target: [0, 0, 0],
    open: 0,
    light: 1.0,
    display: 1.0,
    screen: 1 / 3,
  },
  {
    t: 34,
    camera: [0, 0.1, 30],
    target: [0, 0, 0],
    open: 0,
    light: 1.0,
    display: 1.0,
    screen: 0.5,
  },
  {
    t: 36,
    camera: [-2.0, 0.5, 31],
    target: [0, 0, 0],
    open: 0,
    light: 1.0,
    display: 1.0,
    screen: 1.0,
  },
  // Scene 6: Final Hero Reveal & Seamless Return (t = 36 to 43)
  {
    t: 38,
    camera: [-7.0, 2.5, 31.5],
    target: [0, 0, 0],
    open: 0,
    light: 1.0,
    display: 1.0,
    screen: 1 / 3,
  },
  {
    t: 40,
    camera: [2.0, 3.0, 32.0],
    target: [0, 0, 0],
    open: 0,
    light: 0.9,
    display: 0.4,
    screen: 1 / 3,
  },
  {
    t: 43,
    camera: [8, 3.5, 32],
    target: [0, 0.2, 0],
    open: 0,
    light: 0.85,
    display: 0,
    screen: 0,
  },
];

export function sampleFilm(progress: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const seconds = p * 43;
  let index = keys.findIndex(
    (key, n) =>
      n < keys.length - 1 && seconds >= key.t && seconds <= keys[n + 1].t,
  );
  if (index < 0) index = keys.length - 2;
  const a = keys[index],
    b = keys[index + 1];
  const x = Math.max(0, Math.min(1, (seconds - a.t) / (b.t - a.t))),
    e = x * x * (3 - 2 * x);
  const scalar = (left: number, right: number) => left + (right - left) * e;
  const vector = (left: Vector, right: Vector) =>
    left.map((value, n) => scalar(value, right[n])) as Vector;
  const chapter =
    seconds < 6
      ? 0
      : seconds < 9
        ? 1
        : seconds < 15
          ? 2
          : seconds < 21
            ? 3
            : seconds < 29
              ? 4
              : seconds < 36
                ? 5
                : 6;
  return {
    camera: vector(a.camera, b.camera),
    target: vector(a.target, b.target),
    open: scalar(a.open, b.open),
    light: scalar(a.light, b.light),
    display: scalar(a.display, b.display),
    screen: scalar(a.screen, b.screen),
    chapter,
    seconds,
  };
}
