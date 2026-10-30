import * as THREE from "three";
import { conceptMaterials } from "./materials";
export function roundedShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function slab(w: number, h: number, d: number, r: number) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 20,
  });
  g.translate(0, 0, -d / 2);
  g.computeVertexNormals();
  return g;
}
export function makeConceptModel(texture: THREE.CanvasTexture, mobile = false) {
  const group = new THREE.Group();
  group.name = "NEXOS original concept smartphone";
  const m = conceptMaterials(),
    rear = new THREE.Group(),
    inside = new THREE.Group(),
    finStack = new THREE.Group();
  group.add(inside, rear);
  inside.add(finStack);
  const add = (
    g: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Group = group,
    name = "",
  ) => {
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(x, y, z);
    mesh.name = name;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // Extruded open frame: real sidewalls remain when the rear separates.
  const frameShape = roundedShape(7.25, 15.2, 0.32);
  frameShape.holes.push(
    new THREE.Path(roundedShape(6.94, 14.89, 0.22).getPoints(32).reverse()),
  );
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.82,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 3,
    curveSegments: 20,
  });
  frameGeometry.translate(0, 0, -0.41);
  add(frameGeometry, m.metal, 0, 0, 0, group, "machined open perimeter frame");
  add(
    slab(6.94, 14.9, 0.08, 0.24),
    m.black,
    0,
    0,
    0.35,
    group,
    "display gasket",
  );
  const displayGeometry = new THREE.ShapeGeometry(
    roundedShape(6.7, 14.65, 0.21),
    24,
  );
  const pos = displayGeometry.attributes.position,
    uv = displayGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, pos.getX(i) / 6.7 + 0.5, pos.getY(i) / 14.65 + 0.5);
  const displayMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
  });
  const screen = add(
    displayGeometry,
    displayMaterial,
    0,
    0,
    0.43,
    group,
    "animated AMOLED concept display",
  );
  screen.castShadow = false;
  add(
    new THREE.CircleGeometry(0.105, 32),
    m.black,
    0,
    6.95,
    0.45,
    group,
    "front optical aperture",
  );
  // A distinct original split-back housing, not a replica of a cataloged device.
  const rearMaterial = m.glass.clone();
  rearMaterial.transparent = true;
  rearMaterial.depthWrite = false;
  rearMaterial.opacity = 0.12;
  add(
    slab(6.98, 14.93, 0.055, 0.26),
    rearMaterial,
    0,
    0,
    -0.82,
    rear,
    "transparent technical back glass",
  );
  const plateShape = roundedShape(6.95, 14.9, 0.25);
  const cutout = new THREE.Path();
  cutout.absarc(0, -1.15, 2.44, 0, Math.PI * 2, true);
  plateShape.holes.push(cutout);
  const windowPath = roundedShape(2.4, 2.85, 0.18);
  const windowPoints = windowPath
    .getPoints(20)
    .map((point) => point.add(new THREE.Vector2(-1.55, 5.15)));
  plateShape.holes.push(new THREE.Path(windowPoints.reverse()));
  const plateGeometry = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.015,
    bevelSegments: 2,
    curveSegments: 24,
  });
  add(
    plateGeometry,
    m.metal,
    0,
    0,
    -0.55,
    rear,
    "silver rear technical plate with optical cutouts",
  );
  const lensCenters = [
    [2.1, 6.15, 0.43],
    [0.8, 6.15, 0.43],
    [2.1, 4.85, 0.43],
    [0.8, 4.85, 0.43],
  ];
  lensCenters.forEach(([x, y, r], index) => {
    const barrel = add(
      new THREE.CylinderGeometry(r, r, 0.25, 64),
      m.darkMetal,
      x,
      y,
      -0.88,
      rear,
      `optical barrel ${index}`,
    );
    barrel.rotation.x = Math.PI / 2;
    for (let layer = 0; layer < 5; layer++) {
      const radius = r * (0.93 - layer * 0.115);
      add(
        new THREE.TorusGeometry(radius, 0.018, 8, 64),
        layer % 2 ? m.darkMetal : m.metal,
        x,
        y,
        -1.03 - layer * 0.018,
        rear,
        "machined concentric optical ring",
      );
    }
    const pupil = add(
      new THREE.CircleGeometry(r * 0.45, 48),
      m.black,
      x,
      y,
      -1.015,
      rear,
      "deep aperture",
    );
    pupil.rotation.y = Math.PI;
    // Overlapping curved optical elements supply genuine depth in the macro shot.
    for (let layer = 0; layer < 3; layer++) {
      const optical = add(
        new THREE.SphereGeometry(
          r * (0.8 - layer * 0.12),
          48,
          20,
          0,
          Math.PI * 2,
          0,
          Math.PI,
        ),
        m.lens,
        x,
        y,
        -1.04 - layer * 0.035,
        rear,
        "layered optical glass",
      );
      optical.scale.set(1, 1, 0.13);
    }
    const irisCount = 9,
      matrix = new THREE.Object3D();
    const iris = new THREE.InstancedMesh(
      new THREE.BoxGeometry(r * 0.33, r * 0.08, 0.012),
      m.metal,
      irisCount,
    );
    for (let i = 0; i < irisCount; i++) {
      const a = (i / irisCount) * Math.PI * 2;
      matrix.position.set(
        x + Math.cos(a) * r * 0.3,
        y + Math.sin(a) * r * 0.3,
        -1.1,
      );
      matrix.rotation.set(0, 0, a + 0.6);
      matrix.updateMatrix();
      iris.setMatrixAt(i, matrix.matrix);
    }
    rear.add(iris);
  });
  const flash = add(
    new THREE.CircleGeometry(0.15, 32),
    new THREE.MeshStandardMaterial({ color: "#f5eddc", roughness: 0.22 }),
    2.15,
    3.5,
    -0.76,
    rear,
    "diffused flash",
  );
  flash.rotation.y = Math.PI;
  // Original NEXOS optical motif, not a factual cooling or charging specification.
  const emblem = add(
    new THREE.TorusGeometry(0.82, 0.018, 8, 80),
    m.metal,
    0.1,
    -4.7,
    -0.515,
    rear,
    "NEXOS orbit emblem",
  );
  emblem.scale.x = 1.45;
  emblem.rotation.z = 0.5;
  add(
    new THREE.TorusGeometry(0.38, 0.018, 8, 64),
    m.metal,
    0.1,
    -4.7,
    -0.52,
    rear,
  );
  for (const [y, h] of [
    [2.4, 1.1],
    [-0.2, 2.1],
  ])
    add(
      slab(0.1, h, 0.46, 0.04),
      m.metal,
      3.65,
      y,
      0,
      group,
      "milled side key",
    );
  const polymer = new THREE.MeshStandardMaterial({
    color: "#404c58",
    roughness: 0.8,
  });
  for (const x of [-3.62, 3.62])
    for (const y of [-5.8, 5.8])
      add(
        new THREE.BoxGeometry(0.04, 0.09, 0.82),
        polymer,
        x,
        y,
        0,
        group,
        "antenna seam",
      );
  const port = add(
    slab(1.05, 0.23, 0.025, 0.1),
    m.black,
    0,
    -7.62,
    0,
    group,
    "USB aperture",
  );
  port.rotation.x = Math.PI / 2;
  for (const x of [-2.4, -2.05, -1.7, 1.7, 2.05, 2.4]) {
    const hole = add(
      new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12),
      m.black,
      x,
      -7.62,
      0,
      group,
      "speaker perforation",
    );
    hole.rotation.z = 0;
  }
  // Layered technical interior, all original illustrative geometry.
  add(
    slab(6.7, 14.5, 0.05, 0.2),
    m.board,
    0,
    0,
    -0.1,
    inside,
    "multilayer circuit carrier",
  );
  for (const [x, y, w, h] of [
    [-0.6, 2.3, 2.65, 2.2],
    [1.9, 2.1, 1.3, 1.8],
    [-2, 4.2, 1.1, 2.6],
    [1.7, -4.8, 2, 2.2],
    [-1.3, -4.6, 2.4, 2.5],
  ]) {
    add(
      slab(w, h, 0.12, 0.14),
      m.darkMetal,
      x,
      y,
      -0.27,
      inside,
      "shielded electronics package",
    );
    add(
      slab(w * 0.87, h * 0.85, 0.04, 0.09),
      m.metal,
      x,
      y,
      -0.36,
      inside,
      "machined shield cap",
    );
  }
  const chip = add(
    slab(1.75, 1.38, 0.12, 0.1),
    m.black,
    -0.6,
    2.3,
    -0.45,
    inside,
    "concept processor package",
  );
  chip.name = "illustrative NEXOS logic package";
  // Instanced pins and capacitors: dense geometric detail with bounded draw calls.
  const matrix = new THREE.Object3D();
  const pins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.06, 0.18, 0.04),
    m.copper,
    80,
  );
  for (let i = 0; i < 80; i++) {
    const side = Math.floor(i / 20),
      n = i % 20;
    matrix.position.set(
      -0.6 + (side % 2 ? 1.02 : -0.95 + n * 0.1),
      2.3 + (side % 2 ? -0.68 + n * 0.072 : side === 0 ? 0.84 : -0.84),
      -0.49,
    );
    matrix.rotation.set(0, 0, side % 2 ? Math.PI / 2 : 0);
    matrix.updateMatrix();
    pins.setMatrixAt(i, matrix.matrix);
  }
  inside.add(pins);
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.17, 0.28, 0.1),
    m.darkMetal,
    96,
  );
  for (let i = 0; i < 96; i++) {
    matrix.position.set(
      -2.75 + (i % 12) * 0.49,
      5.8 - Math.floor(i / 12) * 1.55,
      -0.24,
    );
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    caps.setMatrixAt(i, matrix.matrix);
  }
  inside.add(caps);
  const routes: THREE.CatmullRomCurve3[] = [];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1,
      y = -5.6 + i * 1.15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 2.8, y, -0.22),
      new THREE.Vector3(side * 1.8, y + 0.3, -0.22),
      new THREE.Vector3(side * 1.4, y + 0.9, -0.22),
      new THREE.Vector3(0.3, y + 0.9, -0.22),
    ]);
    add(
      new THREE.TubeGeometry(curve, 24, 0.012, 4, false),
      m.copper,
      0,
      0,
      0,
      inside,
      "routed metallic trace",
    );
    routes.push(curve);
  }
  const pulses = routes.map(() =>
    add(
      new THREE.SphereGeometry(0.045, 10, 8),
      m.cyan,
      0,
      0,
      0,
      inside,
      "traveling concept light",
    ),
  );
  // Fins have real thickness and a stepped, separated assembly in the cutaway.
  const finMaterial = m.metal.clone();
  finMaterial.roughness = 0.32;
  const fins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.45, 0.055, 0.28),
    finMaterial,
    mobile ? 18 : 30,
  );
  const count = mobile ? 18 : 30;
  for (let i = 0; i < count; i++) {
    matrix.position.set(0.3, -2.35 + i * (2.2 / count), -0.45);
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    fins.setMatrixAt(i, matrix.matrix);
  }
  finStack.add(fins);
  const orbit = add(
    new THREE.TorusGeometry(2.32, 0.045, 12, 128),
    m.cyan,
    0,
    -1.15,
    -0.76,
    inside,
    "luminous NEXOS technical ring",
  );
  const ring = add(
    new THREE.TorusGeometry(2.44, 0.04, 12, 128),
    m.metal,
    0,
    -1.15,
    -0.58,
    inside,
    "machined ring carrier",
  );
  const blades = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.13, 0.78, 0.06),
    m.darkMetal,
    24,
  );
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    matrix.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, -0.68);
    matrix.rotation.set(0, 0, a - 0.35);
    matrix.updateMatrix();
    blades.setMatrixAt(i, matrix.matrix);
  }
  blades.position.y = -1.15;
  inside.add(blades);
  const rotorHub = add(
    new THREE.CylinderGeometry(0.32, 0.38, 0.22, 48),
    m.metal,
    0,
    -1.15,
    -0.72,
    inside,
    "rotor center spindle",
  );
  rotorHub.rotation.x = Math.PI / 2;
  const screwGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.025, 16);
  for (const x of [-3, 3])
    for (const y of [-6.6, 6.6]) {
      const screw = add(
        screwGeo,
        m.metal,
        x,
        y,
        -0.38,
        inside,
        "chassis fastener",
      );
      screw.rotation.x = Math.PI / 2;
      add(
        new THREE.BoxGeometry(0.09, 0.015, 0.01),
        m.black,
        x,
        y,
        -0.4,
        inside,
        "fastener slot",
      );
    }
  const hub = add(
    new THREE.CylinderGeometry(2.14, 2.14, 0.07, 128),
    m.metal,
    0,
    -1.15,
    -0.63,
    inside,
    "brushed central cooling-inspired disk",
  );
  hub.rotation.x = Math.PI / 2;
  const etch = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1, 0.003, 4, 96),
    m.darkMetal,
    48,
  );
  for (let i = 0; i < 48; i++) {
    const radius = 0.2 + i * 0.04;
    matrix.position.set(0, -1.15, -0.68);
    matrix.rotation.set(0, 0, 0);
    matrix.scale.set(radius, radius, 1);
    matrix.updateMatrix();
    etch.setMatrixAt(i, matrix.matrix);
  }
  inside.add(etch);
  matrix.scale.set(1, 1, 1);
  const segments = new THREE.Group();
  inside.add(segments);
  for (let i = 0; i < 4; i++) {
    const arc = add(
      new THREE.TorusGeometry(2.38, 0.065, 12, 48, Math.PI * 0.39),
      m.cyan,
      0,
      -1.15,
      -0.72,
      segments,
      "segmented blue light ring",
    );
    arc.rotation.z = (i * Math.PI) / 2;
  }
  const gamingKeyMaterial = new THREE.MeshStandardMaterial({
    color: "#8d1725",
    metalness: 0.65,
    roughness: 0.3,
  });
  add(
    slab(0.11, 0.85, 0.48, 0.025),
    gamingKeyMaterial,
    3.66,
    -3.2,
    0,
    group,
    "red side trigger",
  );
  const channels = new THREE.Group();
  inside.add(channels);
  for (let i = 0; i < 4; i++) {
    const x = -2.8 + i * 0.16;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -6.8, -0.32),
      new THREE.Vector3(x, -4.8, -0.32),
      new THREE.Vector3(-1.7 + i * 0.16, -4.2, -0.32),
      new THREE.Vector3(1.5, -4.2 + i * 0.15, -0.32),
      new THREE.Vector3(2.4, -3.4, -0.32),
    ]);
    add(
      new THREE.TubeGeometry(curve, 48, 0.025, 8, false),
      m.cyan,
      0,
      0,
      0,
      channels,
      "blue illuminated technical channel",
    );
  }
  const capGroup = new THREE.Group();
  inside.add(capGroup);
  capGroup.attach(hub);
  capGroup.attach(etch);
  const chipCanvas = document.createElement("canvas");
  chipCanvas.width = 256;
  chipCanvas.height = 128;
  const chipContext = chipCanvas.getContext("2d")!;
  chipContext.fillStyle = "#0c131b";
  chipContext.fillRect(0, 0, 256, 128);
  chipContext.fillStyle = "#a7bac8";
  chipContext.font = "500 34px Arial";
  chipContext.textAlign = "center";
  chipContext.fillText("NEXOS", 128, 58);
  chipContext.font = "13px monospace";
  chipContext.fillText("CONCEPT / LOGIC", 128, 87);
  const chipTexture = new THREE.CanvasTexture(chipCanvas);
  chipTexture.colorSpace = THREE.SRGBColorSpace;
  const legend = add(
    new THREE.PlaneGeometry(1.6, 0.8),
    new THREE.MeshBasicMaterial({ map: chipTexture }),
    -0.6,
    2.3,
    -0.52,
    inside,
    "logic package legend",
  );
  legend.rotation.y = Math.PI;
  for (let i = 0; i < 14; i++) {
    const x = i % 2 ? 3.1 : -3.1,
      y = 6.7 - Math.floor(i / 2) * 2.05;
    const screw = add(
      new THREE.TorusGeometry(0.055, 0.012, 6, 16),
      m.darkMetal,
      x,
      y,
      -0.64,
      rear,
      "rear panel micro fastener",
    );
    screw.rotation.y = Math.PI;
  }
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext("2d")!;
  const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGradient.addColorStop(0, "#ffffffff");
  glowGradient.addColorStop(0.25, "#ffffff66");
  glowGradient.addColorStop(1, "#ffffff00");
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glowPositions = new Float32Array(96 * 3);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    glowPositions[i * 3] = Math.cos(a) * 2.38;
    glowPositions[i * 3 + 1] = -1.15 + Math.sin(a) * 2.38;
    glowPositions[i * 3 + 2] = -0.77;
  }
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(glowPositions, 3),
  );
  const glowMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    color: "#315aff",
    size: 0.3,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  inside.add(new THREE.Points(glowGeometry, glowMaterial));
  m.cyan.envMapIntensity = 0.04;
  m.cyan.toneMapped = false;
  let open = 0;
  return {
    group,
    screen,
    displayMaterial,
    animate(amount: number, time: number) {
      open = amount;
      inside.visible = true;
      rear.visible = amount < 0.995;
      rear.position.set(amount * 3.5, amount * 0.5, -amount * 2.2);
      rearMaterial.opacity = 0.12 * (1 - amount);
      finStack.position.z = -amount * 0.48;
      orbit.rotation.z = time * 0.1;
      ring.rotation.z = -time * 0.05;
      for (let i = 0; i < pulses.length; i++)
        pulses[i].position.copy(
          routes[i].getPoint((time * 0.17 + i * 0.13) % 1),
        );
      m.cyan.emissiveIntensity = 1.4 + Math.sin(time * 1.8) * 0.2;
      m.cyan.emissive.setHSL(
        time > 15 && time < 21 ? 0.98 : 0.61 + Math.sin(time * 0.4) * 0.035,
        0.95,
        0.48,
      );
      capGroup.position.set(amount * 2.8, amount * 0.8, -amount * 0.85);
      capGroup.rotation.y = amount * 0.18;
      blades.rotation.z = time * 1.2;
      finStack.rotation.z = Math.sin(time * 0.4) * 0.018 * amount;
      segments.rotation.z = Math.sin(time * 0.3) * 0.025;
    },
    detail() {
      return { open, instances: 80 + 96 + count + 24 + 27 };
    },
    dispose() {
      glowTexture.dispose();
      glowCanvas.width = glowCanvas.height = 0;
      chipTexture.dispose();
      chipCanvas.width = chipCanvas.height = 0;
      m.dispose();
    },
  };
}
