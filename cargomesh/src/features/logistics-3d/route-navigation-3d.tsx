"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScenePlayback } from "@/features/product-motion/use-motion-preference";
import { ArrowUpRight, MapPin, Navigation, Pause, Play, Route } from "lucide-react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { MapPresentation } from "@/features/v2-road-map/road-map-model";
import { buildCargoMeshTruck, disposeCargoMeshTruck, setTruckWheelAngle, type TruckVisualType } from "./truck-model";
import { readTruckModel } from "./truck-model-assets";
import { loadTruckGlb, disposeTruckAsset } from "./load-truck-glb";
import { buildRouteTrack } from "./route-track";
import { getTruckEnvironment } from "./truck-environment";
import { continuousScenicRoad, landscapeLabels, routeLandscape, scenicChunkIndices, scenicRouteCurve, SCENIC_CHUNK_LENGTH } from "./scenic-route-model";
import { buildScenicRouteTerrain, buildScenicRouteWorld, disposeScenicWorld, prepareScenicRouteTerrain, scenicTerrainElevation } from "./scenic-route-world";
import { buildScenicRouteSky } from "./scenic-route-sky";
import s from "./route-navigation.module.css";

export type RouteNavigationProps = { presentation: MapPresentation; origin: string; destination: string; variant?: TruckVisualType; modelAssetId?: string | null; custom?: boolean; title?: string; loading?: boolean; initialProgress?: number; inactive?: boolean };
/** Original scenic interpretation. Visual travel never changes shipment progress or provider geometry. */
export default function RouteNavigation3D({ presentation, origin, destination, variant = "articulated", modelAssetId, custom = false, title, loading = false, initialProgress = 0, inactive = false }: RouteNavigationProps) {
  const {playing,toggle}=useScenePlayback();
  const paused=useRef(!playing),wake=useRef<(()=>void)|null>(null);
  paused.current=!playing;
  useEffect(()=>{wake.current?.();},[playing]);
  const host = useRef<HTMLDivElement>(null), track = useMemo(() => buildRouteTrack(presentation.paths), [presentation.paths]);
  const landscape = routeLandscape(origin, destination), [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const progress = THREE.MathUtils.clamp(initialProgress, 0, .995);
  useEffect(() => {
    if (!track || !host.current) return;
    const node = host.current, road = continuousScenicRoad(scenicRouteCurve(track), landscape), startCursor = progress * road.length;
    let disposed = false, request = 0, last = 0, elapsed = 0, wheelDistance = 0, placed = false, chunkIndex = Math.floor(startCursor / SCENIC_CHUNK_LENGTH);
    let truck: THREE.Group | null = null, renderer: THREE.WebGLRenderer | null = null, resize: ResizeObserver | null = null, environment: THREE.WebGLRenderTarget | null = null;
    let streamTimer: ReturnType<typeof setTimeout> | null = null, streamed = 0, frames = 0, fpsSince = 0, fps = 0, lastMetrics = 0;
    const chunks = new Map<number, { world: ReturnType<typeof buildScenicRouteWorld>; origin: THREE.Vector3 }>();
    let terrain: ReturnType<typeof buildScenicRouteTerrain> | null = null;
    let terrainTask: ReturnType<typeof prepareScenicRouteTerrain> | null = null;
    const frameOrigin = road.centerAt(chunkIndex * SCENIC_CHUNK_LENGTH), lookTarget = new THREE.Vector3(), previousPoint = road.poseAt(startCursor).point;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(48, 1, .1, 1000), desiredRotation = new THREE.Quaternion();
    let light = getTruckEnvironment(new Date());
    scene.background = new THREE.Color(light.skyHorizon); scene.fog = new THREE.Fog(light.skyHorizon, 115, 245);
    const ambient = new THREE.HemisphereLight(light.skyTop, "#756345", light.ambient * 1.5); scene.add(ambient);
    const sun = new THREE.DirectionalLight(light.sun, light.key); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: .5, far: 140 }); sun.shadow.normalBias = .035; sun.shadow.bias = -.00008; scene.add(sun, sun.target);
    const sky = buildScenicRouteSky(light); scene.add(sky.dome);
    const arrows = new THREE.Group(), arrowMaterial = new THREE.MeshBasicMaterial({ color: "#c0fff1", side: THREE.DoubleSide });
    const arrowShape = new THREE.Shape(); arrowShape.moveTo(-.48, -.5); arrowShape.lineTo(0, .15); arrowShape.lineTo(.48, -.5); arrowShape.lineTo(.48, -.18); arrowShape.lineTo(0, .52); arrowShape.lineTo(-.48, -.18); arrowShape.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(arrowShape); for (let i = 0; i < 18; i++) arrows.add(new THREE.Mesh(arrowGeometry, arrowMaterial)); scene.add(arrows);
    const syncChunks = (cursor: number, immediate = false) => {
      const wanted = scenicChunkIndices(cursor);
      for (const [index, chunk] of chunks) if (!wanted.includes(index)) { scene.remove(chunk.world.root); disposeScenicWorld(chunk.world.root); chunks.delete(index); }
      for (const index of wanted) if (!chunks.has(index)) {
        const from = index * SCENIC_CHUNK_LENGTH, origin = road.centerAt(from), world = buildScenicRouteWorld(road.section(from, from + SCENIC_CHUNK_LENGTH, origin), landscape, { origin, start: from, destination, heightAt: (x, z) => scenicTerrainElevation(road, landscape, x, z) });
        world.root.position.copy(origin).sub(frameOrigin); chunks.set(index, { world, origin }); scene.add(world.root); streamed++;
      }
      const acceptTerrain = (next: ReturnType<typeof buildScenicRouteTerrain>) => {
        if (disposed) { disposeScenicWorld(next.root); return; }
        if (terrain) { scene.remove(terrain.root); disposeScenicWorld(terrain.root); }
        terrain = next; terrain.root.position.copy(terrain.origin).sub(frameOrigin); scene.add(terrain.root);
      };
      if (immediate) acceptTerrain(buildScenicRouteTerrain(road, landscape, cursor));
      else { terrainTask?.cancel(); terrainTask = prepareScenicRouteTerrain(road, landscape, cursor); void terrainTask.promise.then(next => { terrainTask = null; if (next) acceptTerrain(next); }); }
    };
    const refreshLight = () => {
      light = getTruckEnvironment(new Date()); scene.background = new THREE.Color(light.skyHorizon); (scene.fog as THREE.Fog).color.set(light.skyHorizon);
      ambient.color.set(light.skyTop); ambient.intensity = light.ambient * 1.5; sun.color.set(light.sun); sun.intensity = light.key;
      sky.update(elapsed, light); chunks.forEach(({ world }) => world.update(elapsed, light.night));
      terrain?.update(elapsed);
      if (paused.current && renderer && placed && !document.hidden) renderer.render(scene, camera);
    };
    const lightingTimer = setInterval(refreshLight, 30000);
    setState("loading");
    const install = async () => {
      if (modelAssetId) { const asset = await readTruckModel(modelAssetId); if (!asset) throw new Error("MODEL_MISSING"); truck = await loadTruckGlb(await asset.blob.arrayBuffer()); }
      else if (custom) throw new Error("MODEL_MISSING"); else truck = buildCargoMeshTruck(variant);
      if (disposed) { if (modelAssetId) disposeTruckAsset(truck); else disposeCargoMeshTruck(truck); truck = null; return; }
      truck.scale.setScalar(1.45); scene.add(truck);
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(devicePixelRatio, node.clientWidth < 600 ? 1.25 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; node.appendChild(renderer.domElement); renderer.domElement.setAttribute("aria-hidden", "true");
      const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); environment = generator.fromScene(room, .06); scene.environment = environment.texture; scene.environmentIntensity = .4; room.dispose(); generator.dispose();
      const size = () => { if (!renderer) return; const width = node.clientWidth, height = node.clientHeight; renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); if (paused.current && placed) renderer.render(scene, camera); };
      resize = new ResizeObserver(size); resize.observe(node); size(); syncChunks(startCursor, true);
      const animate = (time: number) => {
        if (disposed) return;
        request = requestAnimationFrame(animate);
        if (document.hidden) { last = time; return; }
        if (placed && time - last < 1000 / 60 - .4) return;
        const delta = last ? Math.min((time - last) / 1000, .05) : 0; last = time;
        if (!paused.current && !inactive) elapsed += delta;
        // Continuous visual distance is independent from the operational percentage in the HUD.
        const cursor = startCursor + elapsed * 10.5, pose = road.poseAt(cursor), nextIndex = Math.floor(cursor / SCENIC_CHUNK_LENGTH);
        if (nextIndex !== chunkIndex) {
          chunkIndex = nextIndex; const nextOrigin = road.centerAt(chunkIndex * SCENIC_CHUNK_LENGTH), shift = nextOrigin.clone().sub(frameOrigin);
          camera.position.sub(shift); lookTarget.sub(shift); frameOrigin.copy(nextOrigin);
          chunks.forEach(chunk => chunk.world.root.position.copy(chunk.origin).sub(frameOrigin));
          if (terrain) terrain.root.position.copy(terrain.origin).sub(frameOrigin);
          // Only the section far beyond the visible fog is regenerated, after this frame.
          if (streamTimer === null) streamTimer = setTimeout(() => { streamTimer = null; if (!disposed) syncChunks(cursor); }, 0);
        }
        wheelDistance += previousPoint.distanceTo(pose.point); previousPoint.copy(pose.point);
        const localPoint = pose.point.clone().sub(frameOrigin);
        truck!.position.copy(localPoint).setY(.11 + (inactive || paused.current ? 0 : Math.sin(elapsed * 8) * .012));
        desiredRotation.setFromEuler(new THREE.Euler(0, pose.angle, inactive || paused.current ? 0 : Math.sin(elapsed * 6) * .0015));
        if (!placed) truck!.quaternion.copy(desiredRotation); else truck!.quaternion.slerp(desiredRotation, 1 - Math.exp(-delta * 16));
        if (!modelAssetId) setTruckWheelAngle(truck!, wheelDistance / (.369 * 1.45));
        const mobile = camera.aspect < .8;
        const view = localPoint.clone().addScaledVector(pose.tangent, mobile ? -23 : -18.5).addScaledVector(pose.normal, mobile ? .6 : 6.8).setY(mobile ? 11.8 : 9.4);
        const ahead = road.poseAt(cursor + 6).point.sub(frameOrigin).setY(1.7);
        if (!placed) { camera.position.copy(view); lookTarget.copy(ahead); placed = true; }
        else { camera.position.lerp(view, 1 - Math.exp(-delta * 4)); lookTarget.lerp(ahead, 1 - Math.exp(-delta * 5)); }
        camera.lookAt(lookTarget);
        sky.dome.position.copy(localPoint); sky.update(elapsed, light); sun.position.copy(localPoint).addScaledVector(sky.direction, 75); sun.target.position.copy(localPoint);
        arrows.children.forEach((arrow, index) => { const point = road.poseAt(cursor + 11 + index * 6 + elapsed * 3 % 6); arrow.position.copy(point.point).sub(frameOrigin).setY(.105); arrow.rotation.set(-Math.PI / 2, 0, Math.atan2(-point.tangent.x, -point.tangent.z)); });
        chunks.forEach(({ world }) => world.update(elapsed, light.night)); terrain?.update(elapsed); renderer!.render(scene, camera);
        frames++; if (!fpsSince) fpsSince = time; if (time - fpsSince > 1000) { fps = frames * 1000 / (time - fpsSince); frames = 0; fpsSince = time; }
        const canvas = renderer!.domElement;
        if (paused.current || !lastMetrics || time - lastMetrics > 250) { lastMetrics = time; Object.assign(canvas.dataset, { routeRenderer: "continuous-scenic-three", routeLandscape: landscape, routeProgress: progress.toFixed(5), routeCursor: cursor.toFixed(3), routeBaseLength: road.length.toFixed(3), routeX: pose.point.x.toFixed(3), routeZ: pose.point.z.toFixed(3), routeHeading: pose.angle.toFixed(3), routeVariant: modelAssetId ? "custom" : variant, drawCalls: String(renderer!.info.render.calls), routeChunks: String(chunks.size), routeStreamed: String(streamed), routeChunk: String(chunkIndex), routeFps: fps.toFixed(1), routeGeometries: String(renderer!.info.memory.geometries), routeTextures: String(renderer!.info.memory.textures), environment: light.phase, motion: paused.current ? "paused" : inactive ? "inactive" : "running" }); }
        if (paused.current) { cancelAnimationFrame(request); request = 0; }
      };
      wake.current=()=>{if(!disposed&&!request){last=0;request=requestAnimationFrame(animate);}};
      request = requestAnimationFrame(animate); setState("ready");
    };
    void install().catch(() => { if (!disposed) setState("failed"); });
    return () => {
      disposed = true; wake.current=null; cancelAnimationFrame(request); clearInterval(lightingTimer); if (streamTimer !== null) clearTimeout(streamTimer); terrainTask?.cancel(); resize?.disconnect();
      chunks.forEach(({ world }) => disposeScenicWorld(world.root)); chunks.clear(); if (terrain) disposeScenicWorld(terrain.root); sky.dispose(); arrowGeometry.dispose(); arrowMaterial.dispose();
      if (truck) { if (modelAssetId) disposeTruckAsset(truck); else disposeCargoMeshTruck(truck); } environment?.dispose(); sun.dispose(); scene.clear(); renderer?.dispose(); renderer?.forceContextLoss(); node.replaceChildren();
    };
  }, [track, landscape, variant, modelAssetId, custom, progress, inactive, destination]);
  const absent = !track && !loading;
  return <section className={s.root} aria-label="Recorrido del camión en 3D"><div className={s.stage} data-route-state={absent ? "absent" : state}><div ref={host} className={s.world} role="img" aria-label={`Camión siguiendo una carretera en 3D · ${landscapeLabels[landscape]}`}/>
    {(state === "loading" && !absent) || loading ? <div className={s.message} role="status"><Navigation size={26}/><strong>Preparando el recorrido 3D…</strong></div> : null}
    {absent || state === "failed" ? <div className={s.message} role="status"><Route size={30}/><strong>{absent ? "No hay un recorrido disponible" : "No se pudo abrir la vista 3D"}</strong><p>{absent ? "Calcula una ruta por carretera para ver el recorrido del camión." : custom ? "Comprueba el archivo GLB de tu camión." : "El navegador no pudo iniciar el visor. Vuelve a abrir la vista."}</p></div> : null}
    {!absent && state === "ready" ? <><div className={s.direction}><span><ArrowUpRight size={27}/></span><div><small>Hacia el destino</small><strong>{destination}</strong><p>{landscapeLabels[landscape]}</p></div></div><div className={s.progress}><strong>{Math.round(progress * 100)}%</strong><span>{inactive ? "Recorrido detenido" : progress >= .8 ? "Tramo final" : "En carretera"}</span></div><div className={s.vehicle}><Navigation size={17}/><strong>{title ?? "Camión en ruta"}</strong><span>Guía de recorrido</span></div></> : null}
    </div><div className={s.caption}>{!absent&&state==="ready"?<button className={s.playback} type="button" disabled={inactive} aria-pressed={playing} onClick={toggle}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?"Pausar recorrido":"Reproducir recorrido"}</button>:null}<span><MapPin size={15}/>{origin} → {destination}</span><span>{presentation.distanceKm !== null ? presentation.distanceKm.toLocaleString("es-PE") + " km" : ""} · Vista de recorrido</span></div></section>;
}
