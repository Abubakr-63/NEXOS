import * as THREE from "three";
import { studioLighting } from "./lighting";
import { makeConceptModel } from "./model";
import { createScreen } from "./screen";
import { sampleFilm } from "./film";
import { sampleTimeline } from "./timeline";
import type { PixelScreenState } from "./adapter";
export type PixelEngine = {
  seek: (progress: number) => void;
  film: (progress: number) => void;
  update: (state: PixelScreenState) => void;
  view: (view: "front" | "rear" | "three-quarter") => void;
  zoom: (value: number) => void;
  active: (value: boolean) => void;
  motion: (value: boolean) => void;
  dispose: () => void;
};
export function createPixelEngine(
  canvas: HTMLCanvasElement,
  state: PixelScreenState,
  reduced: boolean,
  compact = false,
): PixelEngine {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!context || context.isContextLost())
    throw new Error("WebGL2 unavailable");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      matchMedia("(max-width: 720px)").matches ? 1 : 1.5,
    ),
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // Contact-shadow texture supplies grounding without a second full geometry pass.
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 150);
  const lighting = studioLighting(renderer, scene);
  const mobile = matchMedia("(max-width: 720px)").matches;
  const screen = createScreen(mobile ? 1 : 1.6);
  const texture = new THREE.CanvasTexture(screen.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const model = makeConceptModel(texture, mobile);
  // Explicit material environment maps retain individual optical/back/frame reflection levels.
  // A scene-only environment uses scene.environmentIntensity instead in this Three.js version.
  model.group.traverse((object) => {
    if (object instanceof THREE.Mesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial)
          material.envMap = scene.environment;
      }
  });
  scene.add(model.group);
  let targetProgress = reduced ? 2 / 6 : 0,
    currentProgress = targetProgress,
    currentState = state;
  let filmTarget: number | null = null,
    filmCurrent = 0;
  let pose: number | null = null,
    zoom = 1,
    smoothZoom = 1,
    smoothY = sampleTimeline(currentProgress).rotation[1],
    visible = true,
    disposed = false,
    raf = 0,
    until = 0,
    previous = 0;
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  const smoothCamera = new THREE.Vector3(0, 0, 35);
  const smoothLook = new THREE.Vector3();
  let cameraInitialized = false;
  let framesRendered = 0;
  const frame = (time: number) => {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(0.05, (time - previous) / 1000 || 0.016);
    previous = time;
    currentProgress = reduced
      ? targetProgress
      : THREE.MathUtils.damp(currentProgress, targetProgress, 9, dt);
    const shot = sampleTimeline(currentProgress);
    smoothZoom = reduced ? zoom : THREE.MathUtils.damp(smoothZoom, zoom, 8, dt);
    let displayProgress = currentProgress;
    let drawDisplay = true;
    if (filmTarget !== null && !reduced) {
      filmCurrent = filmTarget;
      const film = sampleFilm(filmCurrent);
      model.group.rotation.set(0, 0, 0);
      target.set(...film.camera);
      look.set(...film.target);
      lighting.intensity(film.light);
      model.animate(film.open, film.seconds);
      model.displayMaterial.color.setScalar(film.display);
      displayProgress = film.screen;
      drawDisplay = film.display > 0.02;
      canvas.dataset.filmProgress = filmCurrent.toFixed(4);
      canvas.dataset.filmShot = String(film.chapter);
      canvas.dataset.cutaway = film.open.toFixed(3);
      canvas.dataset.cameraDistance = target.distanceTo(look).toFixed(3);
    } else {
      const desiredY = pose ?? shot.rotation[1];
      const deltaY =
        THREE.MathUtils.euclideanModulo(
          desiredY - smoothY + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      smoothY = reduced ? desiredY : smoothY + deltaY * (1 - Math.exp(-8 * dt));
      model.group.rotation.set(shot.rotation[0], smoothY, shot.rotation[2]);
      if (pose !== null) target.set(0, 0, 35);
      else target.set(...shot.camera);
      target.multiplyScalar(1 / smoothZoom);
      if (pose !== null) look.set(0, 0, 0);
      else look.set(...shot.target);
      lighting.intensity(1);
      model.animate(0, 0);
      model.displayMaterial.color.setScalar(1);
      canvas.dataset.cutaway = "0";
    }
    if (!cameraInitialized || reduced) {
      smoothCamera.copy(target);
      smoothLook.copy(look);
      cameraInitialized = true;
    } else {
      smoothCamera.lerp(target, 1 - Math.exp(-12 * dt));
      smoothLook.lerp(look, 1 - Math.exp(-12 * dt));
    }
    camera.position.copy(smoothCamera);
    camera.lookAt(smoothLook);
    if (
      drawDisplay &&
      screen.draw(currentState, displayProgress, reduced ? 0 : time / 1000)
    )
      texture.needsUpdate = true;
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++framesRendered);
    canvas.dataset.screenApps = currentState.apps.join(",");
    canvas.dataset.screenDark = String(currentState.dark);
    canvas.dataset.screenName = currentState.name;
    canvas.dataset.zoom = smoothZoom.toFixed(3);
    canvas.dataset.progress = currentProgress.toFixed(4);
    canvas.dataset.rotation = (
      THREE.MathUtils.euclideanModulo(
        model.group.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI
    ).toFixed(3);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.triangles = String(renderer.info.render.triangles);
    if (
      Math.abs(currentProgress - targetProgress) > 0.0002 ||
      (filmTarget !== null && Math.abs(filmCurrent - filmTarget) > 0.00002) ||
      time < until
    )
      raf = requestAnimationFrame(frame);
  };
  const invalidate = () => {
    if (!raf && !disposed && visible && !document.hidden)
      raf = requestAnimationFrame(frame);
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, rect.width < 480 ? 1 : 1.5),
    );
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else invalidate();
  };
  document.addEventListener("visibilitychange", onVisibility);
  let count = 0,
    instances = 0;
  model.group.traverse((object) => {
    if (object instanceof THREE.Mesh) count++;
    if (object instanceof THREE.InstancedMesh) instances += object.count;
  });
  canvas.dataset.meshes = String(count);
  canvas.dataset.renderer = "three-webgl2";
  canvas.dataset.asset = "nexos-original-concept";
  canvas.dataset.quality = mobile ? "mobile" : "desktop";
  canvas.dataset.instancedDetails = String(instances);
  return {
    film(progress) {
      if (reduced || compact) return;
      const value = Math.max(0, Math.min(1, progress));
      // The identical endpoints make wrapping continuous; never interpolate backwards through the film.
      if (filmTarget !== null && filmTarget > 0.98 && value < 0.02)
        filmCurrent = value;
      if (filmTarget === null) filmCurrent = value;
      filmTarget = value;
      pose = null;
      until = performance.now() + 400;
      invalidate();
    },
    seek(progress) {
      filmTarget = null;
      targetProgress = Math.max(0, Math.min(1, progress));
      pose = null;
      until = performance.now() + 400;
      invalidate();
    },
    update(next) {
      currentState = next;
      until = performance.now() + 450;
      invalidate();
    },
    view(view) {
      pose = view === "rear" ? Math.PI : view === "front" ? 0 : -0.6;
      until = performance.now() + 1500;
      invalidate();
    },
    zoom(value) {
      zoom = Math.max(0.85, Math.min(1.25, value));
      until = performance.now() + 800;
      invalidate();
    },
    motion(value) {
      reduced = value;
      invalidate();
    },
    active(value) {
      visible = value;
      if (value) invalidate();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        }
      });
      texture.dispose();
      model.dispose();
      lighting.dispose();
      screen.dispose();
      renderer.dispose();
    },
  };
}
