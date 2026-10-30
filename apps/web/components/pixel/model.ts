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
    bevelSegments: 4,
    steps: 1,
    curveSegments: 32,
  });
  g.translate(0, 0, -d / 2);
  g.computeVertexNormals();
  return g;
}

/** Canonical Google G brand shape */
function makeGoogleLogoShape(R = 0.48, r = 0.28, barHalfH = 0.09) {
  const shape = new THREE.Shape();
  const aTop = Math.PI * 0.23;
  const aBottom = -Math.asin(barHalfH / R);

  // Outer arc: from aTop (41°) counter-clockwise all the way around to bottom
  shape.absarc(0, 0, R, aTop, Math.PI * 2 + aBottom, false);

  // Crossbar rightmost tip
  shape.lineTo(R, barHalfH);

  // Along top of crossbar to center (x = 0)
  shape.lineTo(0, barHalfH);

  // Down to bottom of crossbar (x = 0, y = -barHalfH)
  shape.lineTo(0, -barHalfH);

  // Along bottom of crossbar to inner circle
  const xBottomInner = Math.sqrt(Math.max(0, r * r - barHalfH * barHalfH));
  shape.lineTo(xBottomInner, -barHalfH);

  // Inner arc: clockwise back to aTop
  const aBottomInner = -Math.asin(barHalfH / r);
  shape.absarc(0, 0, r, Math.PI * 2 + aBottomInner, aTop, true);

  // Close back to outer arc start
  shape.closePath();

  return shape;
}

/** Authentic Google 'G' emblem geometry with subtle 3D metallic extrusion. */
function makeGoogleLogoGeometry() {
  const shape = makeGoogleLogoShape(0.48, 0.28, 0.09);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 36,
  });
  g.computeVertexNormals();
  return g;
}

export function makeConceptModel(texture: THREE.CanvasTexture, mobile = false) {
  const group = new THREE.Group();
  group.name = "Google Pixel 10 Pro flagship model";
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
  // GOOGLE PIXEL 10 PRO UNIBODY FLAT FRAME
  // ==========================================
  // Dark titanium flat perimeter frame with radiused corners
  const frameShape = roundedShape(7.4, 15.8, 0.62);
  frameShape.holes.push(
    new THREE.Path(roundedShape(7.02, 15.42, 0.44).getPoints(36).reverse()),
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
  add(frameGeometry, m.metal, 0, 0, 0, group, "machined titanium unibody frame");

  // Inky black OLED display perimeter bezel
  add(
    slab(7.02, 15.42, 0.08, 0.44),
    m.black,
    0,
    0,
    0.36,
    group,
    "display perimeter bezel",
  );

  // Front Super AMOLED display with rounded corners
  const displayGeometry = new THREE.ShapeGeometry(
    roundedShape(6.84, 15.24, 0.38),
    32,
  );
  const pos = displayGeometry.attributes.position,
    uv = displayGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, pos.getX(i) / 6.84 + 0.5, pos.getY(i) / 15.24 + 0.5);
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

  // Front 2.5D curved protective glass
  const frontGlassMaterial = m.glass.clone();
  frontGlassMaterial.transparent = true;
  frontGlassMaterial.opacity = 0.08;
  frontGlassMaterial.roughness = 0.02;
  add(
    slab(6.98, 15.38, 0.025, 0.4),
    frontGlassMaterial,
    0,
    0,
    0.448,
    group,
    "front 2.5D curved glass",
  );

  // Centered punch-hole selfie camera cutout
  add(
    new THREE.CircleGeometry(0.12, 32),
    m.black,
    0,
    7.18,
    0.455,
    group,
    "centered selfie camera aperture",
  );

  // Top earpiece speaker micro-slit
  add(
    slab(1.4, 0.035, 0.02, 0.015),
    m.darkMetal,
    0,
    7.76,
    0.43,
    group,
    "earpiece speaker micro-slit",
  );

    // ==========================================
  // REAR OPAQUE FROSTED MATTE GLASS BACK PANEL
  // ==========================================
  // 100% Opaque Obsidian frosted matte glass back (no fantasy holes or rings)
  add(
    slab(7.08, 15.48, 0.06, 0.48),
    m.glassBack,
    0,
    0,
    -0.45,
    rear,
    "Pixel 10 Pro frosted matte glass back panel",
  );

  // Centered subtle polished metallic Google 'G' logo flush on back
  const gLogoGeom = makeGoogleLogoGeometry();
  const gLogo = add(
    gLogoGeom,
    m.gLogo,
    0,
    -0.5,
    -0.506,
    rear,
    "Google G brand emblem",
  );
  gLogo.rotation.y = Math.PI;

  // Internal support plate behind back glass
  add(
    slab(6.98, 15.38, 0.04, 0.44),
    m.darkMetal,
    0,
    0,
    -0.4,
    rear,
    "rear chassis structural support",
  );

  // ==========================================
  // GOOGLE PIXEL 10 PRO FLOATING CAMERA ISLAND
  // ==========================================
  // Elevated dark titanium camera stadium pill (floating inside rear margins, NOT touching side rails)
  const cameraIsland = add(
    slab(6.34, 2.32, 0.32, 1.16),
    m.metal,
    0,
    5.35,
    -0.63,
    rear,
    "Pixel 10 Pro floating aluminum camera island",
  );
  cameraIsland.castShadow = true;

  // Diamond-cut polished perimeter chamfer on camera island
  add(
    new THREE.TorusGeometry(1.14, 0.018, 8, 48),
    m.polishedMetal,
    -2.01,
    5.35,
    -0.79,
    rear,
    "island left chamfer ring",
  );
  add(
    new THREE.TorusGeometry(1.14, 0.018, 8, 48),
    m.polishedMetal,
    2.01,
    5.35,
    -0.79,
    rear,
    "island right chamfer ring",
  );

    // Black sapphire optical glass pill window (spans left 76% of the island on rear view)
  const cameraWindow = add(
    slab(4.72, 1.92, 0.04, 0.96),
    m.blackSapphire,
    0.58,
    5.35,
    -0.815,
    rear,
    "black sapphire triple-camera pill window",
  );
  cameraWindow.castShadow = false;

  // Triple Camera Array inside the black sapphire pill window
  // When viewed from rear (180deg rotated), positive X appears on the LEFT
  const cameras = [
    { x: 2.15, y: 5.35, r: 0.38, name: "48MP ultrawide lens" },
    { x: 0.95, y: 5.35, r: 0.48, name: "50MP wide main camera" },
    { x: -0.35, y: 5.35, r: 0.40, name: "48MP periscope telephoto" },
  ];

  cameras.forEach(({ x, y, r, name }, idx) => {
    // Optical barrel
    const barrel = add(
      new THREE.CylinderGeometry(r, r, 0.22, 48),
      m.darkMetal,
      x,
      y,
      -0.72,
      rear,
      `${name} barrel`,
    );
    barrel.rotation.x = Math.PI / 2;

    // Concentric diamond-turned antireflective optical rings
    for (let layer = 0; layer < 4; layer++) {
      const radius = r * (0.92 - layer * 0.14);
      add(
        new THREE.TorusGeometry(radius, 0.016, 8, 48),
        layer % 2 ? m.darkMetal : m.polishedMetal,
        x,
        y,
        -0.84 - layer * 0.012,
        rear,
        "machined optical ring",
      );
    }

    // Deep black optical pupil
    const pupil = add(
      new THREE.CircleGeometry(r * 0.42, 32),
      m.black,
      x,
      y,
      -0.855,
      rear,
      "optical pupil aperture",
    );
    pupil.rotation.y = Math.PI;

    // Curved optical glass elements
    for (let layer = 0; layer < 2; layer++) {
      const optical = add(
        new THREE.SphereGeometry(
          r * (0.8 - layer * 0.15),
          32,
          16,
          0,
          Math.PI * 2,
          0,
          Math.PI,
        ),
        m.lens,
        x,
        y,
        -0.86 - layer * 0.02,
        rear,
        "sapphire optical lens element",
      );
      optical.scale.set(1, 1, 0.12);
    }

    // Periscope rectangular folding prism on telephoto lens
    if (idx === 2) {
      add(
        slab(0.44, 0.44, 0.06, 0.08),
        m.darkMetal,
        x,
        y,
        -0.88,
        rear,
        "periscope folding prism",
      );
    }
  });

  // Right Side of Island on rear view (negative X in model space): True-Tone LED Flash, Spectral/Temperature Sensor, Audio Mic
  // True-tone circular LED flash positioned at [-2.42, 5.88] (appears at top-right on rear view)
  add(
    new THREE.CylinderGeometry(0.24, 0.24, 0.08, 36),
    m.darkMetal,
    -2.42,
    5.88,
    -0.78,
    rear,
    "flash bezel ring",
  ).rotation.x = Math.PI / 2;

  // Concentric Fresnel rings on flash
  for (let ring = 0; ring < 3; ring++) {
    add(
      new THREE.TorusGeometry(0.06 + ring * 0.05, 0.01, 6, 32),
      m.polishedMetal,
      -2.42,
      5.88,
      -0.816,
      rear,
      "Fresnel optical ring",
    );
  }

  // Flash diffuser face
  const flashFace = add(
    new THREE.CircleGeometry(0.21, 32),
    m.flash,
    -2.42,
    5.88,
    -0.818,
    rear,
    "diffused true-tone LED flash",
  );
  flashFace.rotation.y = Math.PI;

  // Infrared Temperature / Multi-Spectral Depth Sensor positioned at [-2.42, 4.82] (appears at bottom-right on rear view)
  add(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32),
    m.darkMetal,
    -2.42,
    4.82,
    -0.78,
    rear,
    "temperature sensor bezel",
  ).rotation.x = Math.PI / 2;

  add(
    new THREE.TorusGeometry(0.14, 0.012, 6, 32),
    m.polishedMetal,
    -2.42,
    4.82,
    -0.816,
    rear,
    "sensor bezel ring",
  );

  const sensorAperture = add(
    new THREE.CircleGeometry(0.14, 32),
    m.lens,
    -2.42,
    4.82,
    -0.818,
    rear,
    "temperature sensor optical window",
  );
  sensorAperture.rotation.y = Math.PI;

  // Audio Zoom Directional Microphone pinhole between sensors
  const micPinhole = add(
    new THREE.CircleGeometry(0.045, 16),
    m.black,
    -1.68,
    5.35,
    -0.812,
    rear,
    "audio zoom microphone pinhole",
  );
  micPinhole.rotation.y = Math.PI;

    // ==========================================
  // HARDWARE RAILS & TACTILE CONTROLS
  // ==========================================
  // Pixel signature key layout: Power button placed ABOVE volume rocker on right rail
  function makeSideButton(height: number, width = 0.36, protrusion = 0.12, r = 0.14) {
    const g = new THREE.ExtrudeGeometry(roundedShape(width, height, r), {
      depth: protrusion,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
    g.translate(0, 0, -protrusion / 2);
    g.computeVertexNormals();
    return g;
  }

  // Power button recess & milled tactile key
  const powerRecess = add(
    new THREE.BoxGeometry(0.06, 1.12, 0.42),
    m.black,
    3.71,
    2.85,
    0,
    group,
    "power button chassis recess",
  );
  void powerRecess;

  const powerKey = add(
    makeSideButton(0.98),
    m.metal,
    3.75,
    2.85,
    0,
    group,
    "milled power button key",
  );
  powerKey.rotation.y = Math.PI / 2;

  const powerChamfer = add(
    makeSideButton(0.96, 0.34, 0.02),
    m.polishedMetal,
    3.80,
    2.85,
    0,
    group,
    "power button chamfer highlight",
  );
  powerChamfer.rotation.y = Math.PI / 2;

  // Volume rocker recess & elongated rocker key
  const volumeRecess = add(
    new THREE.BoxGeometry(0.06, 2.22, 0.42),
    m.black,
    3.71,
    0.65,
    0,
    group,
    "volume rocker chassis recess",
  );
  void volumeRecess;

  const volumeKey = add(
    makeSideButton(2.08),
    m.metal,
    3.75,
    0.65,
    0,
    group,
    "milled volume rocker key",
  );
  volumeKey.rotation.y = Math.PI / 2;

  const volumeChamfer = add(
    makeSideButton(2.06, 0.34, 0.02),
    m.polishedMetal,
    3.80,
    0.65,
    0,
    group,
    "volume rocker chamfer highlight",
  );
  volumeChamfer.rotation.y = Math.PI / 2;

  // Antenna RF insulation seams
  const polymer = new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.85,
  });
  for (const x of [-3.69, 3.69])
    for (const y of [-6.0, 6.0])
      add(
        new THREE.BoxGeometry(0.04, 0.08, 0.84),
        polymer,
        x,
        y,
        0,
        group,
        "antenna seam",
      );

  // Bottom USB-C port
  const port = add(
    slab(1.15, 0.28, 0.03, 0.12),
    m.black,
    0,
    -7.9,
    0,
    group,
    "USB-C aperture",
  );
  port.rotation.x = Math.PI / 2;

  // Bottom stereo speaker perforations
  for (const x of [-2.4, -2.05, -1.7, 1.7, 2.05, 2.4]) {
    const hole = add(
      new THREE.CylinderGeometry(0.065, 0.065, 0.06, 12),
      m.black,
      x,
      -7.9,
      0,
      group,
      "speaker grille hole",
    );
    hole.rotation.z = 0;
  }

  // ==========================================
  // INTERNAL PRECISION ARCHITECTURE (TENSOR CHIP)
  // ==========================================
  // Internal circuit carrier substrate
  add(
    slab(6.8, 14.8, 0.05, 0.2),
    m.board,
    0,
    0,
    -0.08,
    inside,
    "internal motherboard carrier",
  );

  // Internal RF shielding cans
  for (const [x, y, w, h] of [
    [-0.6, 2.3, 2.65, 2.2],
    [1.9, 2.1, 1.3, 1.8],
    [-2, 4.2, 1.1, 2.6],
    [1.7, -4.8, 2, 2.2],
    [-1.3, -4.6, 2.4, 2.5],
  ]) {
    add(
      slab(w, h, 0.1, 0.12),
      m.darkMetal,
      x,
      y,
      -0.22,
      inside,
      "shielded package",
    );
    add(
      slab(w * 0.88, h * 0.86, 0.03, 0.08),
      m.metal,
      x,
      y,
      -0.28,
      inside,
      "shield cap",
    );
  }

  // Google Tensor G5 Processor Package
  const chip = add(
    slab(1.85, 1.48, 0.1, 0.1),
    m.black,
    -0.6,
    2.3,
    -0.34,
    inside,
    "Google Tensor G5 processor package",
  );
  chip.name = "Google Tensor G5 processor";

  // Instanced interconnect gold pin matrix: 80 count
  const matrix = new THREE.Object3D();
  const pins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.06, 0.16, 0.04),
    m.copper,
    80,
  );
  for (let i = 0; i < 80; i++) {
    const side = Math.floor(i / 20),
      n = i % 20;
    matrix.position.set(
      -0.6 + (side % 2 ? 1.02 : -0.95 + n * 0.1),
      2.3 + (side % 2 ? -0.68 + n * 0.072 : side === 0 ? 0.84 : -0.84),
      -0.38,
    );
    matrix.rotation.set(0, 0, side % 2 ? Math.PI / 2 : 0);
    matrix.updateMatrix();
    pins.setMatrixAt(i, matrix.matrix);
  }
  inside.add(pins);

  // Instanced micro-capacitors: 96 count
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.26, 0.08),
    m.darkMetal,
    96,
  );
  for (let i = 0; i < 96; i++) {
    matrix.position.set(
      -2.75 + (i % 12) * 0.49,
      5.8 - Math.floor(i / 12) * 1.55,
      -0.2,
    );
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    caps.setMatrixAt(i, matrix.matrix);
  }
  inside.add(caps);

  // Vapor Chamber Copper Cooling Plate Fins: 30 count
  const finMaterial = m.copper.clone();
  finMaterial.roughness = 0.28;
  const count = mobile ? 18 : 30;
  const fins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.4, 0.05, 0.22),
    finMaterial,
    count,
  );
  for (let i = 0; i < count; i++) {
    matrix.position.set(0.2, -2.2 + i * (2.1 / count), -0.32);
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    fins.setMatrixAt(i, matrix.matrix);
  }
  finStack.add(fins);

  // Instanced chassis internal micro-screws: 48 count
  const screwMaterial = m.polishedMetal.clone();
  screwMaterial.roughness = 0.15;
  const screws = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12),
    screwMaterial,
    48,
  );
  for (let i = 0; i < 48; i++) {
    const side = Math.floor(i / 24);
    const n = i % 24;
    matrix.position.set(
      side === 0 ? -3.2 : 3.2,
      -6.8 + n * 0.6,
      -0.3,
    );
    matrix.rotation.set(Math.PI / 2, 0, 0);
    matrix.updateMatrix();
    screws.setMatrixAt(i, matrix.matrix);
  }
  inside.add(screws);

  // Instanced memory bus micro-contacts: 36 count
  const contacts = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    m.copper,
    36,
  );
  for (let i = 0; i < 36; i++) {
    matrix.position.set(
      1.2 + (i % 6) * 0.18,
      2.8 - Math.floor(i / 6) * 0.18,
      -0.34,
    );
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    contacts.setMatrixAt(i, matrix.matrix);
  }
  inside.add(contacts);

  // Total instanced details: 80 + 96 + 30 + 48 + 36 = 290 (> 250 required)

  return {
    group,
    displayMaterial,
    animate(amount: number, seconds = 0) {
      void seconds;
      // Rear panel only lifts subtly during cutaway teardown inspection
      // Phone ALWAYS remains whole and solid
      rear.position.set(0, 0, -amount * 0.35);
      finStack.position.set(0, 0, -amount * 0.15);
      inside.position.set(0, 0, -amount * 0.08);
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material))
            object.material.forEach((mat) => mat.dispose());
          else object.material.dispose();
        }
      });
      m.dispose();
      gLogoGeom.dispose();
      frameGeometry.dispose();
      displayGeometry.dispose();
    },
  };
}
