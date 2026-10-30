import * as THREE from "three";

/** Google Pixel 10 Pro flagship hardware materials. */
export function conceptMaterials() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#181a20";
  context.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y++) {
    const level = 20 + ((y * 137) % 15);
    context.fillStyle = `rgb(${level},${level},${level + 2})`;
    context.fillRect(0, y, 512, 1);
  }

  const brushed = new THREE.CanvasTexture(canvas);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(4, 16);

  // Google Pixel 10 Pro Dark Titanium Frame & Camera Island
  const metal = new THREE.MeshPhysicalMaterial({
    color: "#15181f",
    metalness: 0.94,
    roughness: 0.28,
    roughnessMap: brushed,
    envMapIntensity: 0.35,
    clearcoat: 0.45,
    clearcoatRoughness: 0.1,
  });

  // Polished Chrome Google G Emblem & Diamond Chamfers
  const polishedMetal = new THREE.MeshStandardMaterial({
    color: "#cbd5e1",
    metalness: 0.96,
    roughness: 0.12,
    envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });

  // Interior Gunmetal & Optical Barrels
  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#181c24",
    metalness: 0.9,
    roughness: 0.25,
    envMapIntensity: 0.4,
  });

  // Google Pixel 10 Pro Matte Frosted Glass Back (Obsidian Deep Charcoal)
  const glassBack = new THREE.MeshPhysicalMaterial({
    color: "#080a0d",
    metalness: 0.02,
    roughness: 0.48,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.18,
    transparent: false,
    opacity: 1.0,
  });

  // Front 2.5D Protective Display Glass
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#05070a",
    metalness: 0.1,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.7,
  });

  // Deep Obsidian High-Gloss Optical Black (Jet Black Camera Cutout & Bezels)
  const black = new THREE.MeshBasicMaterial({
    color: "#000000",
  });

  // True-Tone Diffused LED Flash
  const flash = new THREE.MeshStandardMaterial({
    color: "#fef9c3",
    roughness: 0.2,
    metalness: 0.1,
    emissive: "#fef08a",
    emissiveIntensity: 0.5,
  });

  // Thermal Copper (Vapor Chamber & Contacts)
  const copper = new THREE.MeshStandardMaterial({
    color: "#b45309",
    metalness: 0.92,
    roughness: 0.25,
    envMapIntensity: 0.6,
  });

  // Motherboard PCB Substrate
  const board = new THREE.MeshStandardMaterial({
    color: "#0f172a",
    metalness: 0.4,
    roughness: 0.5,
  });

  // Radiant Cyan (Technical Buses)
  const cyan = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    emissive: "#0ea5e9",
    emissiveIntensity: 1.5,
    metalness: 0.3,
    roughness: 0.2,
  });

  // Anti-reflective Sapphire Optical Glass (Lenses & Temperature Sensor)
  const lens = new THREE.MeshPhysicalMaterial({
    color: "#021324",
    metalness: 0.4,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.9,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    metal,
    darkMetal,
    glass,
    glassBack,
    polishedMetal,
    flash,
    black,
    copper,
    board,
    cyan,
    lens,
    brushed,
    dispose() {
      brushed.dispose();
      canvas.width = canvas.height = 0;
    },
  };
}
