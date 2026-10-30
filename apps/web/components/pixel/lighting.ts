import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
export function studioLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
) {
  RectAreaLightUniformsLib.init();
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.03, 0.1, 100);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight("#ffffff", 2);
  key.position.set(-8, 13, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.001;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#dae5f0", 3.2);
  rim.position.set(8, 5, -9);
  scene.add(rim);
  const fill = new THREE.DirectionalLight("#c6d5e6", 1.35);
  fill.position.set(6, -2, 10);
  scene.add(fill);
  const rear = new THREE.DirectionalLight("#e6edf5", 2.2);
  rear.position.set(-7, 9, -14);
  scene.add(rear);
  const strip = new THREE.RectAreaLight("#e7efff", 5, 2, 18);
  strip.position.set(-9, 3, -8);
  strip.lookAt(0, 0, 0);
  scene.add(strip);
  const softbox = new THREE.RectAreaLight("#bde7f4", 3, 9, 12);
  softbox.position.set(7, 7, -10);
  softbox.lookAt(0, 0, 0);
  scene.add(softbox);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.ShadowMaterial({ opacity: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -7.85;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = document.createElement("canvas");
  contact.width = contact.height = 64;
  const ctx = contact.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#00000088");
  gradient.addColorStop(1, "#00000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(contact);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 6),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -7.8;
  scene.add(shadow);
  return {
    key,
    intensity(amount: number) {
      key.intensity = 2 * amount;
      rear.intensity = 2.2 * amount;
      fill.intensity = 1.1 * amount;
      rim.intensity = 1.8 * Math.max(0.25, amount);
      strip.intensity = 4 * amount;
      softbox.intensity = 2.5 * amount;
    },
    dispose() {
      key.shadow.dispose();
      environment.dispose();
      texture.dispose();
      contact.width = contact.height = 0;
    },
  };
}
