import * as THREE from "three";

/** Flagship smartphone materials with photorealistic physical properties. */
export function conceptMaterials() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#d4d4d8";
  context.fillRect(0, 0, 512, 512);

  // Micro-brushed anisotropic grain for anodized aluminum frame
  for (let y = 0; y < 512; y++) {
    const level = 190 + ((y * 137) % 55);
    context.fillStyle = `rgb(${level},${level},${level})`;
    context.fillRect(0, y, 512, 1);
  }

  const brushed = new THREE.CanvasTexture(canvas);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(4, 16);

  // Aerospace Anodized Aluminum (Frame & Camera Visor Bar)
  const metal = new THREE.MeshPhysicalMaterial({
    color: "#e2e8f0",
    metalness: 0.98,
    roughness: 0.14,
    roughnessMap: brushed,
    envMapIntensity: 0.95,
    clearcoat: 0.45,
    clearcoatRoughness: 0.08,
  });

  // Gunmetal Anodized Aluminum (Interior & Optics)
  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#334155",
    metalness: 0.9,
    roughness: 0.22,
    envMapIntensity: 0.6,
  });

  // Corning Gorilla Glass Victus (Back Panel with deep sapphire obsidian tone)
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#08162b",
    metalness: 0.15,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.75,
  });

  // High-gloss Obsidian Optical Black (Camera Visor Pill & Bezels)
  const black = new THREE.MeshStandardMaterial({
    color: "#020408",
    roughness: 0.12,
    envMapIntensity: 0.25,
  });

  // Thermal Copper (Vapor chamber & contact pins)
  const copper = new THREE.MeshStandardMaterial({
    color: "#b45309",
    metalness: 0.92,
    roughness: 0.25,
    envMapIntensity: 0.7,
  });

  // High-density PCB Substrate
  const board = new THREE.MeshStandardMaterial({
    color: "#1e293b",
    metalness: 0.45,
    roughness: 0.5,
  });

  // Radiant Electric Cyan (Energy buses & status glow)
  const cyan = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    emissive: "#0ea5e9",
    emissiveIntensity: 1.6,
    metalness: 0.3,
    roughness: 0.2,
  });

  // Anti-reflective Sapphire Optical Glass (Camera Lenses)
  const lens = new THREE.MeshPhysicalMaterial({
    color: "#031930",
    metalness: 0.4,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.95,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    metal,
    darkMetal,
    glass,
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
