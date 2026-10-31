export const FILM_DURATION = 43000;

export const filmScenes = [
  {
    title: "Tactile ignition",
    label: "Designed from the inside out.",
    detail:
      "Precision titanium tactile controls and instant luminous boot.",
  },
  {
    title: "Floating showcase",
    label: "A closer kind of clarity.",
    detail:
      "Floating diagonal perspective with vibrant front display and studio reflections.",
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

export type Vector = [number, number, number];

export type FilmKey = {
  t: number;
  camera: Vector;
  target: Vector;
  open: number;
  light: number;
  display: number;
  screen: number;
  buttonPress?: number;
  rotation?: Vector;
  position?: Vector;
};

/**
 * Strict Front & Side Camera Paths:
 * Rear hemisphere is completely forbidden. All camera positions remain strictly in front (Z >= 3.2).
 * Dot product with device front normal is >= 0.88 across all 43 seconds.
 */
const keys: FilmKey[] = [
  // Scene 0: Power Button Approach & Tactile Ignition (t = 0 to 4.5s)
  // Macro side profile focusing on power key at y = 2.85, screen black
  {
    t: 0,
    camera: [5.2, 2.85, 3.8],
    target: [3.6, 2.85, 0.2],
    open: 0,
    light: 0.9,
    display: 0,
    screen: 0,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
  {
    t: 0.8,
    camera: [4.8, 2.85, 3.5],
    target: [3.7, 2.85, 0.1],
    open: 0,
    light: 1.0,
    display: 0,
    screen: 0,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
  // Physical mechanical depression inward into chassis
  {
    t: 0.95,
    camera: [4.8, 2.85, 3.5],
    target: [3.7, 2.85, 0.1],
    open: 0,
    light: 1.15,
    display: 0.05,
    screen: 0,
    buttonPress: 1.0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
  // Mechanical release back outward; immediate luminous screen wake-up begins!
  {
    t: 1.15,
    camera: [4.6, 2.7, 4.2],
    target: [3.2, 2.7, 0.2],
    open: 0,
    light: 1.1,
    display: 0.7,
    screen: 0,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
  // Boot glow & radiant cyan ring
  {
    t: 1.8,
    camera: [3.2, 2.2, 8.5],
    target: [2.0, 1.8, 0.2],
    open: 0,
    light: 1.05,
    display: 1.0,
    screen: 0.15,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
  // Camera smoothly pulls back; dual-row lockscreen clock reveals
  {
    t: 3.2,
    camera: [1.6, 1.0, 18.0],
    target: [0.8, 0.6, 0.1],
    open: 0,
    light: 1.0,
    display: 1.0,
    screen: 0.35,
    buttonPress: 0,
    rotation: [0.04, -0.08, -0.05],
    position: [0, 0, 0],
  },

  // Scene 1: REDMAGIC-Inspired Floating Product Showcase Pose (t = 4.5 to 12.0s)
  // Entire phone visible, diagonal tilt, suspended in space, cyan studio rim highlights
  {
    t: 5.0,
    camera: [0, 0.2, 36.5],
    target: [0, 0, 0],
    open: 0,
    light: 1.15,
    display: 1.0,
    screen: 0.5,
    buttonPress: 0,
    rotation: [0.16, -0.4, -0.32],
    position: [0, 0.2, 0],
  },
  {
    t: 8.0,
    camera: [0, 0.2, 36.5],
    target: [0, 0, 0],
    open: 0,
    light: 1.2,
    display: 1.0,
    screen: 0.6,
    buttonPress: 0,
    rotation: [0.17, -0.38, -0.3],
    position: [0, 0.35, 0],
  },
  {
    t: 11.5,
    camera: [0, 0.2, 36.5],
    target: [0, 0, 0],
    open: 0,
    light: 1.15,
    display: 1.0,
    screen: 0.7,
    buttonPress: 0,
    rotation: [0.14, -0.32, -0.25],
    position: [0, 0.1, 0],
  },

  // Scene 2: Front Layered Architecture & Technical Cutaway (t = 12.0 to 18.0s)
  {
    t: 14.0,
    camera: [-2.2, 2.5, 7.8],
    target: [-0.2, 1.0, 0.4],
    open: 1.0,
    light: 1.1,
    display: 1.0,
    screen: 0.8,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
  {
    t: 17.0,
    camera: [2.5, 2.2, 8.2],
    target: [0.2, 1.8, 0.4],
    open: 1.0,
    light: 1.15,
    display: 1.0,
    screen: 0.9,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },

  // Scene 3: Configuration Intent & Front Chassis Sweep (t = 18.0 to 24.0s)
  {
    t: 21.0,
    camera: [-2.5, -0.4, 9.5],
    target: [0.2, -1.0, 0.4],
    open: 0.6,
    light: 1.0,
    display: 1.0,
    screen: 1.0,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },

  // Scene 4: Fluid Material You & Applications Reveal (t = 24.0 to 30.0s)
  {
    t: 26.0,
    camera: [2.8, -1.2, 11.5],
    target: [0.3, -0.8, 0.3],
    open: 0,
    light: 1.1,
    display: 1.0,
    screen: 0.7,
    buttonPress: 0,
    rotation: [0.05, -0.15, -0.08],
    position: [0, 0, 0],
  },

  // Scene 5: Sensory Live UI & Performance Preset Sweep (t = 30.0 to 36.0s)
  {
    t: 31.0,
    camera: [0, 0.2, 26.0],
    target: [0, 0, 0],
    open: 0,
    light: 1.05,
    display: 1.0,
    screen: 0.5,
    buttonPress: 0,
    rotation: [0.08, -0.22, -0.14],
    position: [0, 0.1, 0],
  },

  // Scene 6: Final Hero Reveal & Seamless Return to Origin (t = 36.0 to 43.0s)
  {
    t: 36.0,
    camera: [-1.5, 0.4, 32.0],
    target: [0, 0, 0],
    open: 0,
    light: 1.0,
    display: 1.0,
    screen: 1.0 / 3,
    buttonPress: 0,
    rotation: [0.1, -0.25, -0.18],
    position: [0, 0, 0],
  },
  {
    t: 40.0,
    camera: [3.8, 2.0, 16.0],
    target: [2.5, 1.8, 0.2],
    open: 0,
    light: 0.95,
    display: 0.4,
    screen: 0,
    buttonPress: 0,
    rotation: [0.04, -0.08, -0.04],
    position: [0, 0, 0],
  },
  // Exact identical loop endpoint matching t = 0s
  {
    t: 43.0,
    camera: [5.2, 2.85, 3.8],
    target: [3.6, 2.85, 0.2],
    open: 0,
    light: 0.9,
    display: 0,
    screen: 0,
    buttonPress: 0,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  },
];

export function sampleFilm(progress: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  if (p <= 0) {
    const k = keys[0];
    return {
      camera: [...k.camera] as Vector,
      target: [...k.target] as Vector,
      open: k.open,
      light: k.light,
      display: k.display,
      screen: k.screen,
      buttonPress: k.buttonPress ?? 0,
      rotation: [...(k.rotation ?? [0, 0, 0])] as Vector,
      position: [...(k.position ?? [0, 0, 0])] as Vector,
      chapter: 0,
      seconds: 0,
    };
  }
  if (p >= 1) {
    const k = keys[keys.length - 1];
    return {
      camera: [...k.camera] as Vector,
      target: [...k.target] as Vector,
      open: k.open,
      light: k.light,
      display: k.display,
      screen: k.screen,
      buttonPress: k.buttonPress ?? 0,
      rotation: [...(k.rotation ?? [0, 0, 0])] as Vector,
      position: [...(k.position ?? [0, 0, 0])] as Vector,
      chapter: 6,
      seconds: 43,
    };
  }

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

  // Base interpolated values
  const camera = vector(a.camera, b.camera);
  const target = vector(a.target, b.target);
  const open = scalar(a.open, b.open);
  const light = scalar(a.light, b.light);
  const display = scalar(a.display, b.display);
  const screen = scalar(a.screen, b.screen);
  const buttonPress = scalar(a.buttonPress ?? 0, b.buttonPress ?? 0);
  const rotation = vector(
    a.rotation ?? [0, 0, 0],
    b.rotation ?? [0, 0, 0],
  );
  const position = vector(
    a.position ?? [0, 0, 0],
    b.position ?? [0, 0, 0],
  );

  // Subtle organic levitation breathing during the floating product showcase pose (5s to 12s)
  if (seconds >= 4.8 && seconds <= 12.0) {
    const floatBlend =
      Math.sin(Math.min(1, Math.max(0, (seconds - 4.8) / 1.5)) * Math.PI * 0.5) *
      (1 - Math.max(0, Math.min(1, (seconds - 10.5) / 1.5)));
    position[1] += Math.sin((seconds - 4.8) * 1.2) * 0.12 * floatBlend;
    position[2] += Math.cos((seconds - 4.8) * 0.9) * 0.08 * floatBlend;
    rotation[0] += Math.sin((seconds - 4.8) * 1.0) * 0.012 * floatBlend;
    rotation[1] += Math.cos((seconds - 4.8) * 0.8) * 0.018 * floatBlend;
    rotation[2] += Math.sin((seconds - 4.8) * 0.9) * 0.008 * floatBlend;
  }

  const chapter =
    seconds < 4.5
      ? 0
      : seconds < 12.0
        ? 1
        : seconds < 18.0
          ? 2
          : seconds < 24.0
            ? 3
            : seconds < 30.0
              ? 4
              : seconds < 36.0
                ? 5
                : 6;

  return {
    camera,
    target,
    open,
    light,
    display,
    screen,
    buttonPress,
    rotation,
    position,
    chapter,
    seconds,
  };
}
