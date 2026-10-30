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
    color: "#bac5d0",
    metalness: 1,
    roughness: 0.25,
    roughnessMap: brushed,
    envMapIntensity: 0.75,
    clearcoat: 0.25,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#677783",
    metalness: 0.85,
    roughness: 0.35,
    envMapIntensity: 0.4,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#a9c0d2",
    metalness: 0.18,
    roughness: 0.13,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.3,
  });
  const black = new THREE.MeshStandardMaterial({
    color: "#02050a",
    roughness: 0.22,
    envMapIntensity: 0.08,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: "#b58157",
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 0.6,
  });
  const board = new THREE.MeshStandardMaterial({
    color: "#647481",
    metalness: 0.4,
    roughness: 0.55,
  });
  const cyan = new THREE.MeshStandardMaterial({
    color: "#477aff",
    emissive: "#254cff",
    emissiveIntensity: 1.3,
    metalness: 0.35,
    roughness: 0.25,
  });
  const lens = new THREE.MeshPhysicalMaterial({
    color: "#142b48",
    metalness: 0.45,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.65,
    transparent: true,
    opacity: 0.65,
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
