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
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 4,
    steps: 1,
    curveSegments: 32,
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

  // ==========================================
  // GOOGLE PIXEL PRO AEROSPACE ALUMINUM CHASSIS
  // ==========================================
  // Unibody pebble-curved perimeter frame
  const frameShape = roundedShape(7.3, 15.4, 0.52);
  frameShape.holes.push(
    new THREE.Path(roundedShape(6.94, 15.04, 0.36).getPoints(36).reverse()),
  );
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.84,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    bevelSegments: 4,
    curveSegments: 32,
  });
  frameGeometry.translate(0, 0, -0.42);
  add(frameGeometry, m.metal, 0, 0, 0, group, "machined open perimeter frame");

  // Inky black display bezel & gasket
  add(
    slab(6.94, 15.04, 0.08, 0.36),
    m.black,
    0,
    0,
    0.36,
    group,
    "display gasket",
  );

  // Front AMOLED display with rounded corners
  const displayGeometry = new THREE.ShapeGeometry(
    roundedShape(6.76, 14.86, 0.32),
    32,
  );
  const pos = displayGeometry.attributes.position,
    uv = displayGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, pos.getX(i) / 6.76 + 0.5, pos.getY(i) / 14.86 + 0.5);
  const displayMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
  });
  const screen = add(
    displayGeometry,
    displayMaterial,
    0,
    0,
    0.435,
    group,
    "animated AMOLED concept display",
  );
  screen.castShadow = false;

  // Front 2.5D curved protective glass with subtle specular Fresnel sheen
  const frontGlassMaterial = m.glass.clone();
  frontGlassMaterial.transparent = true;
  frontGlassMaterial.opacity = 0.09;
  frontGlassMaterial.roughness = 0.02;
  add(
    slab(6.88, 14.98, 0.025, 0.34),
    frontGlassMaterial,
    0,
    0,
    0.448,
    group,
    "front 2.5D curved protective glass",
  );

  // Front punch-hole selfie camera
  add(
    new THREE.CircleGeometry(0.11, 32),
    m.black,
    0,
    7.02,
    0.455,
    group,
    "front optical aperture",
  );

  // Top earpiece speaker micro-grille slit
  add(
    slab(1.3, 0.035, 0.02, 0.015),
    m.darkMetal,
    0,
    7.6,
    0.43,
    group,
    "earpiece speaker slit",
  );

  // Rear Corning Gorilla Glass Victus back panel (deep sapphire obsidian satin finish)
  const rearMaterial = m.glass.clone();
  rearMaterial.transparent = true;
  rearMaterial.depthWrite = false;
  rearMaterial.opacity = 0.12;
  add(
    slab(6.98, 15.06, 0.055, 0.36),
    rearMaterial,
    0,
    0,
    -0.82,
    rear,
    "transparent technical back glass",
  );

  // Rear housing technical plate
  const plateShape = roundedShape(6.96, 15.04, 0.34);
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
    curveSegments: 28,
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

  // ==========================================
  // GOOGLE PIXEL PRO SIGNATURE CAMERA VISOR BAR
  // ==========================================
  // Sculpted horizontal aluminum visor bridge spanning edge-to-edge
  const visorBar = add(
    slab(7.26, 2.26, 0.36, 0.62),
    m.metal,
    0,
    5.5,
    -0.96,
    rear,
    "Google Pixel Pro horizontal camera visor bar",
  );
  visorBar.castShadow = true;

  // Dark polished sapphire optical pill window inset into visor
  const visorPill = add(
    slab(5.7, 1.48, 0.09, 0.68),
    m.black,
    -0.34,
    5.5,
    -1.1,
    rear,
    "Pixel camera visor sapphire optical window",
  );
  visorPill.castShadow = false;

  // Camera lens centers (positioned to align with film.ts macro camera at [2.1, 6.15, -1.05])
  const lensCenters = [
    [2.1, 6.15, 0.42], // Main 50MP Octa PD Wide Camera
    [0.8, 6.15, 0.38], // 48MP Quad PD Ultrawide Camera
    [2.1, 4.85, 0.36], // 48MP 5x Periscope Telephoto Camera
    [0.8, 4.85, 0.32], // Multi-zone ToF / Spectral Depth Sensor
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

    // Diamond-turned concentric antireflective optical rings
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

    // Deep black optical pupil
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

    // Multi-element curved optical glass domes
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

    // 9-blade internal aperture iris
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

  // Periscope telephoto rectangular folding prism housing
  add(
    slab(0.48, 0.48, 0.08, 0.08),
    m.darkMetal,
    2.1,
    4.85,
    -1.14,
    rear,
    "periscope telephoto folding prism housing",
  );

  // Dual-tone true-tone LED Flash disk
  const flash = add(
    new THREE.CircleGeometry(0.18, 32),
    new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.18,
      metalness: 0.1,
      emissive: "#e0f2fe",
      emissiveIntensity: 0.45,
    }),
    -2.45,
    5.5,
    -1.12,
    rear,
    "diffused flash",
  );
  flash.rotation.y = Math.PI;

  // Infrared temperature sensor aperture
  const tempSensor = add(
    new THREE.CircleGeometry(0.12, 32),
    m.lens,
    -2.45,
    4.9,
    -1.12,
    rear,
    "infrared temperature sensor aperture",
  );
  tempSensor.rotation.y = Math.PI;

  // Audio zoom directional microphone pinhole
  const micPinhole = add(
    new THREE.CircleGeometry(0.04, 16),
    m.black,
    -2.45,
    6.1,
    -1.12,
    rear,
    "audio zoom microphone",
  );
  micPinhole.rotation.y = Math.PI;

  // Google/NEXOS minimalist circular orbit emblem centered on lower back
  const emblem = add(
    new THREE.TorusGeometry(0.72, 0.024, 12, 96),
    m.metal,
    0,
    -4.0,
    -0.84,
    rear,
    "NEXOS orbit emblem",
  );
  emblem.scale.x = 1.0;
  add(
    new THREE.CircleGeometry(0.35, 48),
    m.darkMetal,
    0,
    -4.0,
    -0.842,
    rear,
    "emblem inner disk",
  ).rotation.y = Math.PI;

  // ==========================================
  // HARDWARE RAILS & TACTILE CONTROLS
  // ==========================================
  // Pixel signature key layout: Power button placed ABOVE volume rocker on right rail
  // Power button (upper right rail)
  add(
    slab(0.09, 0.95, 0.46, 0.04),
    m.metal,
    3.68,
    2.8,
    0,
    group,
    "milled power key",
  );

  // Volume rocker (lower right rail)
  add(
    slab(0.09, 1.95, 0.46, 0.04),
    m.metal,
    3.68,
    0.6,
    0,
    group,
    "milled volume rocker",
  );

  // Symmetrical antenna RF insulation bands
  const polymer = new THREE.MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.85,
  });
  for (const x of [-3.64, 3.64])
    for (const y of [-5.8, 5.8])
      add(
        new THREE.BoxGeometry(0.04, 0.09, 0.84),
        polymer,
        x,
        y,
        0,
        group,
        "antenna seam",
      );

  // Bottom USB-C aperture
  const port = add(
    slab(1.1, 0.26, 0.025, 0.1),
    m.black,
    0,
    -7.7,
    0,
    group,
    "USB aperture",
  );
  port.rotation.x = Math.PI / 2;

  // Bottom micro-machined stereo speaker and microphone holes
  for (const x of [-2.4, -2.05, -1.7, 1.7, 2.05, 2.4]) {
    const hole = add(
      new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12),
      m.black,
      x,
      -7.7,
      0,
      group,
      "speaker perforation",
    );
    hole.rotation.z = 0;
  }

  // ==========================================
  // INTERNAL MOTHERBOARD & TENSOR ARCHITECTURE
  // ==========================================
  // Multilayer PCB carrier
  add(
    slab(6.7, 14.5, 0.05, 0.2),
    m.board,
    0,
    0,
    -0.1,
    inside,
    "multilayer circuit carrier",
  );

  // Shielded RF & processing packages
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

  // Flagship NEXOS Tensor AI Processing Package
  const chip = add(
    slab(1.85, 1.48, 0.12, 0.1),
    m.black,
    -0.6,
    2.3,
    -0.45,
    inside,
    "concept processor package",
  );
  chip.name = "illustrative NEXOS logic package";

  // Instanced interconnect gold pins: 80 count
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

  // Instanced micro-capacitors: 96 count
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

  // Circuit bus traces
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

  // Electric cyan energy pulses along data buses
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

  // Precision copper cooling assembly: 30 count
  const finMaterial = m.metal.clone();
  finMaterial.roughness = 0.32;
  const count = mobile ? 18 : 30;
  const fins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.45, 0.055, 0.28),
    finMaterial,
    count,
  );
  for (let i = 0; i < count; i++) {
    matrix.position.set(0.3, -2.35 + i * (2.2 / count), -0.45);
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    fins.setMatrixAt(i, matrix.matrix);
  }
  finStack.add(fins);

  // Luminous cyan technical energy ring
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

  // Turbine fan blades: 24 count
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

  // Chassis precision micro-fasteners
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

  // Etched concentric thermal grooves: 48 count
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

  // Segmented blue illumination arcs
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

  // Cyan illuminated bus channels
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

  // Tensor Processor Legend Canvas Texture
  const chipCanvas = document.createElement("canvas");
  chipCanvas.width = 256;
  chipCanvas.height = 128;
  const chipContext = chipCanvas.getContext("2d")!;
  chipContext.fillStyle = "#070e1b";
  chipContext.fillRect(0, 0, 256, 128);
  chipContext.fillStyle = "#38bdf8";
  chipContext.font = "700 32px Arial";
  chipContext.textAlign = "center";
  chipContext.fillText("NEXOS", 128, 52);
  chipContext.fillStyle = "#94a3b8";
  chipContext.font = "12px monospace";
  chipContext.fillText("TENSOR / AI ENGINE", 128, 82);
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

  // Rear panel micro fasteners
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

  // Cyan ambient energy glow points
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext("2d")!;
  const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGradient.addColorStop(0, "#ffffffff");
  glowGradient.addColorStop(0.25, "#38bdf888");
  glowGradient.addColorStop(1, "#38bdf800");
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
    color: "#38bdf8",
    size: 0.32,
    transparent: true,
    opacity: 0.55,
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
      rear.visible = true;

      // Realistic subtle micro-inspection lift in Z only.
      // The phone NEVER separates into floating pieces or disjointed debris!
      rear.position.set(0, 0, -amount * 0.35);
      rearMaterial.opacity = 0.12 * (1 - amount * 0.85);
      finStack.position.z = -amount * 0.15;

      orbit.rotation.z = time * 0.1;
      ring.rotation.z = -time * 0.05;
      for (let i = 0; i < pulses.length; i++)
        pulses[i].position.copy(
          routes[i].getPoint((time * 0.17 + i * 0.13) % 1),
        );
      m.cyan.emissiveIntensity = 1.4 + Math.sin(time * 1.8) * 0.2;
      m.cyan.emissive.setHSL(
        time > 15 && time < 21 ? 0.55 : 0.58 + Math.sin(time * 0.4) * 0.035,
        0.95,
        0.52,
      );
      capGroup.position.set(0, 0, -amount * 0.2);
      blades.rotation.z = time * 1.2;
      finStack.rotation.z = Math.sin(time * 0.4) * 0.018 * amount;
      segments.rotation.z = Math.sin(time * 0.3) * 0.025;
    },
    detail() {
      return { open, instances: 80 + 96 + count + 24 + 48 };
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
