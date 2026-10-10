import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCargoMeshTruck, disposeCargoMeshTruck, setTruckWheelAngle } from "../logistics-3d/truck-model";
import { getTruckEnvironment } from "../logistics-3d/truck-environment";
import { scenicChunkIndices, SCENIC_CHUNK_LENGTH } from "../logistics-3d/scenic-route-model";
import { buildScenicRouteTerrain, buildScenicRouteWorld, disposeScenicWorld, prepareScenicRouteTerrain, scenicTerrainElevation } from "../logistics-3d/scenic-route-world";
import { createEntranceRoad } from "./entrance-road";
import { buildEntranceSky } from "./entrance-sky";
import { buildEntranceWoodland } from "./entrance-woodland";

/** Client-only original cinematic backdrop; no storage, provider calls or operational writes. */
export function mountEntranceScene(node: HTMLDivElement) {
  const road = createEntranceRoad(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .1, 1200);
  let light = getTruckEnvironment(new Date()), elapsed = 0, last = 0, frame = 0, disposed = false, placed = false, wheelDistance = 0;
  const start = 100, frameOrigin = road.centerAt(0), previousPoint = road.poseAt(start).point, lookTarget = new THREE.Vector3();
  let currentChunk = 0, streamed = 0, lastMetrics = 0, fpsSince = 0, frames = 0, fps = 0;
  let renderer: THREE.WebGLRenderer | null = null, truck: THREE.Group | null = null, resize: ResizeObserver | null = null, reflection: THREE.WebGLRenderTarget | null = null;
  let streamTimer: ReturnType<typeof setTimeout> | null = null, terrain: ReturnType<typeof buildScenicRouteTerrain> | null = null;
  let terrainTask: ReturnType<typeof prepareScenicRouteTerrain> | null = null;
  const chunks = new Map<number, { world: ReturnType<typeof buildScenicRouteWorld>; woodland: ReturnType<typeof buildEntranceWoodland>; origin: THREE.Vector3 }>();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sky = buildEntranceSky(light); scene.add(sky.dome);
  const hemisphere = new THREE.HemisphereLight(light.skyHorizon, "#576140", light.ambient * 1.6); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(light.sun, light.key); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 150 }); sun.shadow.normalBias = .035; sun.shadow.bias = -.00006; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#afcbd9", light.fill * .5); scene.add(fill, fill.target);
  const headlights: THREE.SpotLight[] = [];
  scene.fog = new THREE.Fog(light.skyHorizon, 100, 265);

  const dispose = () => {
    if (disposed) return; disposed = true; cancelAnimationFrame(frame); clearInterval(clockTimer);
    if (streamTimer !== null) clearTimeout(streamTimer); terrainTask?.cancel(); resize?.disconnect();
    document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", restart);
    renderer?.domElement.removeEventListener("webglcontextlost", lost);
    chunks.forEach(({ world, woodland }) => { disposeScenicWorld(world.root); disposeScenicWorld(woodland.root); }); chunks.clear();
    if (terrain) disposeScenicWorld(terrain.root); if (truck) disposeCargoMeshTruck(truck);
    sky.dispose(); reflection?.dispose(); sun.dispose(); headlights.forEach(headlight => headlight.dispose());
    scene.clear(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
  };
  const lighting = () => {
    light = getTruckEnvironment(new Date()); node.dataset.environment = light.phase;
    (scene.fog as THREE.Fog).color.set(light.skyHorizon); hemisphere.color.set(light.skyHorizon); hemisphere.intensity = light.ambient * 1.6;
    sun.color.set(light.sun); sun.intensity = light.key; fill.intensity = light.fill * .5; scene.environmentIntensity = .5 - light.night * .3;
    headlights.forEach(headlight => { headlight.intensity = light.night * 145; });
    truck?.traverse(mesh => { if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      if (mesh.name === "lamp") mesh.material.emissiveIntensity = .3 + light.night * 3;
      if (mesh.name === "red" || mesh.name === "amber") mesh.material.emissiveIntensity = .2 + light.night * .8;
    } });
    sky.update(elapsed, light);
  };
  const sync = (cursor: number, initial = false) => {
    const wanted = scenicChunkIndices(cursor);
    for (const [index, chunk] of chunks) if (!wanted.includes(index)) { scene.remove(chunk.world.root, chunk.woodland.root); disposeScenicWorld(chunk.world.root); disposeScenicWorld(chunk.woodland.root); chunks.delete(index); }
    for (const index of wanted) if (!chunks.has(index)) {
      const from = index * SCENIC_CHUNK_LENGTH, origin = road.centerAt(from), heightAt = (x: number, z: number) => scenicTerrainElevation(road, "countryside", x, z);
      const world = buildScenicRouteWorld(road.section(from, from + SCENIC_CHUNK_LENGTH, origin), "countryside", { origin, start: from, heightAt, guide: false, signs: false, trees: false });
      const woodland = buildEntranceWoodland(road, from, SCENIC_CHUNK_LENGTH, origin, heightAt);
      world.root.position.copy(origin).sub(frameOrigin); woodland.root.position.copy(world.root.position); chunks.set(index, { world, woodland, origin }); scene.add(world.root, woodland.root); streamed++;
    }
    const accept = (next: ReturnType<typeof buildScenicRouteTerrain>) => {
      if (disposed) { disposeScenicWorld(next.root); return; }
      if (terrain) { scene.remove(terrain.root); disposeScenicWorld(terrain.root); }
      terrain = next; terrain.root.position.copy(terrain.origin).sub(frameOrigin); scene.add(terrain.root);
    };
    if (initial) accept(buildScenicRouteTerrain(road, "countryside", cursor));
    else { terrainTask?.cancel(); const task = prepareScenicRouteTerrain(road, "countryside", cursor); terrainTask = task; void task.promise.then(next => { if (terrainTask === task) terrainTask = null; if (next) accept(next); }); }
  };
  const draw = (time: number) => {
    frame = 0; if (disposed || document.hidden || !renderer || !truck) return;
    const delta = last ? Math.min((time - last) / 1000, .05) : 0; last = time;
    if (!motion.matches) elapsed += delta;
    const cursor = start + elapsed * 12.5, pose = road.poseAt(cursor), nextChunk = Math.floor(cursor / SCENIC_CHUNK_LENGTH);
    if (nextChunk !== currentChunk) {
      currentChunk = nextChunk; const nextOrigin = road.centerAt(currentChunk * SCENIC_CHUNK_LENGTH), shift = nextOrigin.clone().sub(frameOrigin);
      camera.position.sub(shift); lookTarget.sub(shift); frameOrigin.copy(nextOrigin);
      chunks.forEach(chunk => { chunk.world.root.position.copy(chunk.origin).sub(frameOrigin); chunk.woodland.root.position.copy(chunk.world.root.position); });
      if (terrain) terrain.root.position.copy(terrain.origin).sub(frameOrigin);
      if (streamTimer === null) streamTimer = setTimeout(() => { streamTimer = null; if (!disposed) sync(cursor); }, 0);
    }
    wheelDistance += previousPoint.distanceTo(pose.point); previousPoint.copy(pose.point);
    const point = pose.point.clone().sub(frameOrigin), suspension = motion.matches ? 0 : Math.sin(elapsed * 8) * .009;
    truck.position.copy(point).setY(.04 + suspension); truck.rotation.set(0, pose.angle, motion.matches ? 0 : Math.sin(elapsed * 5) * .0015);
    setTruckWheelAngle(truck, wheelDistance / (.369 * 1.65));
    const mobile = camera.aspect < .85;
    camera.fov = mobile ? 49 : 42; camera.updateProjectionMatrix();
    const view = point.clone().addScaledVector(pose.tangent, mobile ? 27 : 20).addScaledVector(pose.normal, mobile ? 15 : 17).setY(mobile ? 10.2 : 6.7);
    const focus = point.clone().addScaledVector(pose.tangent, -1.5).addScaledVector(pose.normal, mobile ? -3 : -1.2).setY(mobile ? 3.1 : 2.8);
    if (!placed) { camera.position.copy(view); lookTarget.copy(focus); placed = true; }
    else { camera.position.lerp(view, 1 - Math.exp(-delta * 4)); lookTarget.lerp(focus, 1 - Math.exp(-delta * 5)); }
    camera.lookAt(lookTarget); sky.dome.position.copy(point); sky.update(elapsed, light);
    sun.position.copy(point).addScaledVector(sky.direction, 80); sun.target.position.copy(point);
    fill.position.copy(point).addScaledVector(pose.normal, 30).add(new THREE.Vector3(0, 18, -30)); fill.target.position.copy(point);
    chunks.forEach(chunk => { chunk.world.update(elapsed, light.night); chunk.woodland.update(elapsed); }); terrain?.update(elapsed);
    renderer.render(scene, camera); frames++;
    if (!fpsSince) fpsSince = time; if (time - fpsSince >= 1000) { fps = frames * 1000 / (time - fpsSince); frames = 0; fpsSince = time; }
    if (!lastMetrics || time - lastMetrics >= 500) {
      lastMetrics = time; Object.assign(renderer.domElement.dataset, { entranceRenderer: "three-cinematic-road", cursor: cursor.toFixed(3), heading: pose.angle.toFixed(4), wheelAngle: (wheelDistance / (.369 * 1.65)).toFixed(3), chunks: String(chunks.size), streamed: String(streamed), fps: fps.toFixed(1), environment: light.phase, localHour: String(new Date().getHours()), motion: motion.matches ? "reduced" : "running", drawCalls: String(renderer.info.render.calls), geometries: String(renderer.info.memory.geometries), textures: String(renderer.info.memory.textures) });
    }
    if (!motion.matches) frame = requestAnimationFrame(draw);
  };
  const restart = () => { if (disposed || document.hidden) return; last = 0; if (!frame) frame = requestAnimationFrame(draw); };
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; last = 0; } else { lighting(); restart(); } };
  const lost = (event: Event) => { event.preventDefault(); node.dataset.scene = "fallback"; dispose(); };
  const clockTimer = setInterval(() => { lighting(); if (motion.matches) restart(); }, 30000);
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.addEventListener("webglcontextlost", lost); node.appendChild(renderer.domElement);
    const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); reflection = generator.fromScene(room, .06); scene.environment = reflection.texture; room.dispose(); generator.dispose();
    truck = buildCargoMeshTruck("articulated"); truck.scale.setScalar(1.65); scene.add(truck);
    for (const side of [-1, 1]) {
      const headlight = new THREE.SpotLight("#fff3d4", 0, 38, .4, .6, 1.7), target = new THREE.Object3D();
      headlight.position.set(-3.75, 1.01, side * .46); target.position.set(-26, .15, side * 1.7); headlight.target = target; truck.add(headlight, target); headlights.push(headlight);
    }
    lighting(); sync(start, true);
    const size = () => {
      if (!renderer || disposed) return; const width = node.clientWidth, height = node.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 600 ? 1.25 : 1.5)); renderer.setSize(width, height);
      const shadowSize = width < 600 ? 1024 : 2048;
      if (sun.shadow.mapSize.x !== shadowSize) { sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(shadowSize, shadowSize); }
      camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); placed = false; restart();
    };
    resize = new ResizeObserver(size); resize.observe(node); size();
    document.addEventListener("visibilitychange", visibility); motion.addEventListener("change", restart); node.dataset.scene = "ready";
  } catch { node.dataset.scene = "fallback"; dispose(); }
  return dispose;
}
