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
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();

  // Studio Key Light: Crisp directional sunlight / main key
  const key = new THREE.DirectionalLight("#ffffff", 2.4);
  key.position.set(-8, 14, 15);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.001;
  key.shadow.radius = 4;
  scene.add(key);

  // Commercial Rim Light: Brilliant cyan-blue edge reflection
  const rim = new THREE.DirectionalLight("#38bdf8", 3.8);
  rim.position.set(8.5, 5.5, -9);
  scene.add(rim);

  // Secondary Fill Light: Deep sapphire blue ambience
  const fill = new THREE.DirectionalLight("#60a5fa", 1.6);
  fill.position.set(6, -2, 11);
  scene.add(fill);

  // Rear Specular Light
  const rear = new THREE.DirectionalLight("#dbeafe", 2.4);
  rear.position.set(-7, 9, -14);
  scene.add(rear);

  // Commercial Studio Light Strip (long highlight down the metal rails)
  const strip = new THREE.RectAreaLight("#0ea5e9", 5.2, 2.5, 20);
  strip.position.set(-9, 3, -8);
  strip.lookAt(0, 0, 0);
  scene.add(strip);

  // Overhead Softbox (smooth reflection across front & back glass)
  const softbox = new THREE.RectAreaLight("#7dd3fc", 3.6, 10, 14);
  softbox.position.set(7, 8, -10);
  softbox.lookAt(0, 0, 0);
  scene.add(softbox);

  // Ground Plane
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.ShadowMaterial({ opacity: 0.12 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -7.85;
  floor.receiveShadow = true;
  scene.add(floor);

  // Soft Ambient Occlusion Contact Shadow underneath the phone
  const contact = document.createElement("canvas");
  contact.width = contact.height = 128;
  const ctx = contact.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(2, 6, 23, 0.75)");
  gradient.addColorStop(0.35, "rgba(2, 6, 23, 0.35)");
  gradient.addColorStop(0.7, "rgba(2, 6, 23, 0.1)");
  gradient.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(contact);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6.5),
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
      key.intensity = 2.4 * amount;
      rear.intensity = 2.4 * amount;
      fill.intensity = 1.4 * amount;
      rim.intensity = 2.2 * Math.max(0.3, amount);
      strip.intensity = 4.6 * amount;
      softbox.intensity = 3.2 * amount;
    },
    dispose() {
      key.shadow.dispose();
      environment.dispose();
      texture.dispose();
      contact.width = contact.height = 0;
    },
  };
}
