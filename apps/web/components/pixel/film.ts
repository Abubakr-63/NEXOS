export const FILM_DURATION = 43000;
export const filmScenes = [
  {
    title: "Device reveal",
    label: "Designed from the inside out.",
    detail:
      "An original NEXOS concept device. Metal, optical glass and considered detail.",
  },
  {
    title: "Optical macro",
    label: "A closer kind of clarity.",
    detail:
      "Layered optical surfaces and machined rings, rendered as real geometry.",
  },
  {
    title: "Technical cutaway",
    label: "Beneath the surface.",
    detail:
      "An original technical illustration. Components and light paths are conceptual hardware, not verified specifications.",
  },
  {
    title: "Configuration intent",
    label: "Precision, in every choice.",
    detail:
      "Visualizing configuration preferences. No measured CPU, FPS or thermal improvements.",
  },
  {
    title: "Cooling study",
    label: "Form. Flow. Focus.",
    detail:
      "A sculptural cooling-inspired study. NEXOS does not add a physical cooling system.",
  },
  {
    title: "NEXOS Android",
    label: "A screen that becomes yours.",
    detail:
      "Animated themes, applications and Calendar in an original interface concept. Not a running Android OS.",
  },
  {
    title: "Final hero",
    label: "Your phone. Your Android. Your rules.",
    detail:
      "Your ideas, expressed as a configuration draft. Compilation and device compatibility remain unverified.",
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
const keys: Key[] = [
  {
    t: 0,
    camera: [-12, 4, -35],
    target: [0, 0, 0],
    open: 0,
    light: 0.18,
    display: 0,
    screen: 0,
  },
  {
    t: 3,
    camera: [-8, 2, -33],
    target: [0, 0.3, 0],
    open: 0,
    light: 1,
    display: 0,
    screen: 0,
  },
  {
    t: 6,
    camera: [2.1, 6.15, -7],
    target: [2.1, 6.15, -1.05],
    open: 0,
    light: 1,
    display: 0,
    screen: 0,
  },
  {
    t: 8,
    camera: [2.2, 6.2, -4.8],
    target: [2.1, 6.15, -1.05],
    open: 0,
    light: 0.9,
    display: 0,
    screen: 0,
  },
  {
    t: 10,
    camera: [3.5, 4, -11],
    target: [0.2, 1, -0.3],
    open: 1,
    light: 1,
    display: 0,
    screen: 0,
  },
  {
    t: 14,
    camera: [-3.2, 3, -8],
    target: [0.5, 1, -0.3],
    open: 1,
    light: 1,
    display: 0,
    screen: 0,
  },
  {
    t: 17,
    camera: [2.8, 2.8, -5.6],
    target: [0.2, 2.1, -0.4],
    open: 1,
    light: 1.15,
    display: 0,
    screen: 0,
  },
  {
    t: 21,
    camera: [-3, -0.2, -7],
    target: [0.3, -1.2, -0.5],
    open: 1,
    light: 0.9,
    display: 0,
    screen: 0,
  },
  {
    t: 25,
    camera: [3.5, -2.3, -6.5],
    target: [0.3, -1.5, -0.6],
    open: 1,
    light: 1.1,
    display: 0,
    screen: 0,
  },
  {
    t: 28,
    camera: [1, -1, -12],
    target: [0, -0.4, 0],
    open: 0.8,
    light: 1,
    display: 0,
    screen: 0,
  },
  {
    t: 30,
    camera: [18, 3, -25],
    target: [0, 0, 0],
    open: 0,
    light: 1,
    display: 0.2,
    screen: 0,
  },
  {
    t: 32,
    camera: [21, 1, 24],
    target: [0, 0, 0],
    open: 0,
    light: 1,
    display: 1,
    screen: 1 / 3,
  },
  {
    t: 34,
    camera: [1, 0.2, 31],
    target: [0, 0, 0],
    open: 0,
    light: 1,
    display: 1,
    screen: 0.5,
  },
  {
    t: 36,
    camera: [-3, 1, 32],
    target: [0, 0, 0],
    open: 0,
    light: 1,
    display: 1,
    screen: 1,
  },
  {
    t: 38,
    camera: [-22, 3, 24],
    target: [0, 0, 0],
    open: 0,
    light: 1,
    display: 1,
    screen: 1 / 3,
  },
  {
    t: 40,
    camera: [-34, 3, -2],
    target: [0, 0, 0],
    open: 0,
    light: 0.8,
    display: 0.4,
    screen: 1 / 3,
  },
  {
    t: 43,
    camera: [-12, 4, -35],
    target: [0, 0, 0],
    open: 0,
    light: 0.18,
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
