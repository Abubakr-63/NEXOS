import * as THREE from "three";
/** Original deterministic microfinish. No external image assets. */
export function conceptMaterials() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#b8b8b8";
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const level = 150 + ((y * 73) % 65);
    context.fillStyle = `rgb(${level},${level},${level})`;
    context.fillRect(0, y, 256, 1);
  }
  const brushed = new THREE.CanvasTexture(canvas);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(3, 8);
  const metal = new THREE.MeshPhysicalMaterial({
    color: "#d0d9e2",
    metalness: 0.95,
    roughness: 0.18,
    roughnessMap: brushed,
    envMapIntensity: 0.85,
    clearcoat: 0.35,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#475569",
    metalness: 0.85,
    roughness: 0.3,
    envMapIntensity: 0.5,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#94b8d7",
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.45,
  });
  const black = new THREE.MeshStandardMaterial({
    color: "#030712",
    roughness: 0.18,
    envMapIntensity: 0.12,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: "#b58157",
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 0.6,
  });
  const board = new THREE.MeshStandardMaterial({
    color: "#334155",
    metalness: 0.4,
    roughness: 0.55,
  });
  const cyan = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    emissive: "#0ea5e9",
    emissiveIntensity: 1.5,
    metalness: 0.35,
    roughness: 0.22,
  });
  const lens = new THREE.MeshPhysicalMaterial({
    color: "#0a2540",
    metalness: 0.45,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.8,
    transparent: true,
    opacity: 0.72,
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
