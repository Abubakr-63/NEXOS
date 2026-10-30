const keys = [
  {
    rotation: [-0.12, -2.7, -0.09],
    camera: [0, 1.5, 33],
    target: [0, 0.2, 0],
    light: 0.65,
  },
  {
    rotation: [0.04, -0.65, 0.06],
    camera: [1, 0.6, 34],
    target: [0, 0.2, 0],
    light: 1.15,
  },
  { rotation: [0, 0.02, 0], camera: [0, 0, 34], target: [0, 0, 0], light: 1.1 },
  {
    rotation: [0.03, -0.17, -0.02],
    camera: [0.5, 0, 33],
    target: [0, 0, 0],
    light: 1.1,
  },
  {
    rotation: [-0.08, 0.65, 0.02],
    camera: [0.5, 0.4, 33],
    target: [0, 0, 0],
    light: 0.85,
  },
  {
    rotation: [0, -0.18, 0],
    camera: [-0.5, 0, 34],
    target: [0, 0, 0],
    light: 1.05,
  },
  {
    rotation: [0, 0.12, 0],
    camera: [0, 0, 35],
    target: [0, 0, 0],
    light: 1.15,
  },
];
export function sampleTimeline(progress: number) {
  const p =
    Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 6;
  const index = Math.min(5, Math.floor(p));
  const x = p - index;
  const t = x * x * (3 - 2 * x);
  const a = keys[index],
    b = keys[index + 1];
  const mix = (left: number[], right: number[]) =>
    left.map((value, n) => value + (right[n] - value) * t) as [
      number,
      number,
      number,
    ];
  return {
    rotation: mix(a.rotation, b.rotation),
    camera: mix(a.camera, b.camera),
    target: mix(a.target, b.target),
    light: a.light + (b.light - a.light) * t,
    chapter: Math.min(6, Math.floor(p + 0.001)),
  };
}
