'use client';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Color, Group, MathUtils, OrthographicCamera, PMREMGenerator, SRGBColorSpace, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildDepot, disposeDepot } from './depot-model';
import { buildDepotActors, animateDepotActors } from './depot-actors';
import { buildCargoMeshTruck, disposeCargoMeshTruck, setTruckCargoAccess, setTruckWheelAngle } from './truck-model';
import { depotYardPose } from './depot-yard-pose';
import type { DepotCoordinator } from './depot-coordinator';
import { truckDesign } from './visual-catalog';

export type YardViewControls = { zoom: (factor: number) => void; overview: () => void };
type Props = {
  controller: DepotCoordinator; color: string; active: boolean; running: boolean; reduced: boolean; night: number;
  onReady: () => void; onFailure: () => void; onControls: (controls: YardViewControls | null) => void;
};
function Yard({ controller, color, active, running, reduced, night, onReady, onFailure, onControls }: Props) {
  const { camera, gl, scene, size, invalidate } = useThree();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const designKey = state.vehicles.map(vehicle => vehicle.designId).join(':');
  const templateId = state.templateId;
  const orbit = useRef<OrbitControls | null>(null), guided = useRef(true), frames = useRef(0);
  const focusKey = useRef(''), focusTarget = useRef(new Vector3()), focusPosition = useRef(new Vector3());
  const world = useMemo(() => {
    const depot = buildDepot(color, templateId), actors = buildDepotActors('articulated');
    const trucks = new Map<string, Group>(), payloads = new Map<string, Group>();
    depot.root.add(actors.root);
    for (const vehicle of controller.getSnapshot().vehicles) {
      const truck = buildCargoMeshTruck(vehicle.family, { cargoAccess: vehicle.cargo !== null, appearance: truckDesign(vehicle.designId)?.appearance, designId: vehicle.designId });
      truck.scale.setScalar(.58); truck.userData.assetId = vehicle.assetId; trucks.set(vehicle.assetId, truck);
      if (vehicle.cargo) {
        // Payload instances share immutable resources within this scene only.
        const payload = vehicle.assetId === 'visual-truck-a' ? actors.payload : actors.payload.clone(true);
        truck.add(payload); payloads.set(vehicle.assetId, payload);
      }
    }
    return { depot, actors, trucks, payloads };
  }, [controller, color, templateId, designKey]);
  useEffect(() => {
    const { depot, actors, trucks, payloads } = world;
    invalidate(); onReady();
    // Passive cleanup runs after React removes the previous primitives. Disposing
    // objects while they are still rendered causes WebGL to upload them again.
    return () => {
      payloads.forEach((payload, id) => { trucks.get(id)?.remove(payload); if (payload !== actors.payload) payload.clear(); });
      actors.root.add(actors.payload); // Release shared payload resources once.
      disposeDepot(depot.root); trucks.forEach(disposeCargoMeshTruck);
    };
  }, [world, invalidate, onReady]);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement); orbit.current = controls;
    controls.target.set(0, 0, 1); controls.enablePan = true; controls.enableDamping = !reduced;
    controls.minZoom = 3; controls.maxZoom = 100; controls.minPolarAngle = .08; controls.maxPolarAngle = Math.PI / 2 - .03;
    controls.dampingFactor = .12; controls.rotateSpeed = .6; controls.zoomSpeed = .7;
    const change = () => invalidate(), manual = () => { guided.current = false; invalidate(); };
    const overview = () => { controller.select(null, true); guided.current = true; focusKey.current = ''; invalidate(); };
    const zoom = (factor: number) => { manual(); camera.zoom = MathUtils.clamp(camera.zoom * factor, 3, 100); camera.updateProjectionMatrix(); controls.update(0); invalidate(); };
    const key = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
      event.preventDefault(); manual();
      if (event.key === 'Home') overview();
      else if (event.key === '-' || event.key === '+' || event.key === '=') zoom(event.key === '-' ? 1 / 1.2 : 1.2);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') controls.rotateLeft(event.key === 'ArrowLeft' ? .12 : -.12);
      else controls.rotateUp(event.key === 'ArrowUp' ? .1 : -.1);
      controls.update(0); invalidate();
    };
    const node = gl.domElement; node.tabIndex = 0;
    node.setAttribute('aria-label', 'Interactive depot. Drag to orbit, scroll to zoom. Arrow keys rotate; Home returns to overview.');
    node.addEventListener('keydown', key); node.addEventListener('webglcontextlost', onFailure);
    controls.addEventListener('start', manual); controls.addEventListener('change', change); onControls({ zoom, overview });
    return () => { onControls(null); node.removeEventListener('keydown', key); node.removeEventListener('webglcontextlost', onFailure); controls.removeEventListener('start', manual); controls.removeEventListener('change', change); controls.dispose(); orbit.current = null; };
  }, [camera, gl, controller, reduced, invalidate, onControls, onFailure]);
  useEffect(() => controller.subscribe(() => invalidate()), [controller, invalidate]);
  useEffect(() => {
    const generator = new PMREMGenerator(gl), room = new RoomEnvironment();
    const environment = generator.fromScene(room, .05, .1, 100, { size: 128 }), previous = scene.environment;
    scene.environment = environment.texture; room.dispose(); generator.dispose();
    return () => { scene.environment = previous; environment.dispose(); };
  }, [gl, scene]);
  useEffect(() => { scene.background = new Color('#e4edf0').lerp(new Color('#192c42'), night); scene.environmentIntensity = .75 - night * .4; invalidate(); }, [night, scene, invalidate]);
  useEffect(() => { if (!active || !running) return; const timer = window.setInterval(invalidate, 1000 / 30); return () => window.clearInterval(timer); }, [active, running, invalidate]);
  useEffect(() => { if (active) invalidate(2); }, [active, size, invalidate]);
  useFrame((_, delta) => {
    if (!world) return;
    const snapshot = controller.getSnapshot(), time = controller.getElapsedMs();
    for (const vehicle of snapshot.vehicles) {
      const truck = world.trucks.get(vehicle.assetId)!, pose = depotYardPose(vehicle, time);
      truck.visible = pose.visible; truck.position.copy(pose.position).setY(.21); truck.rotation.y = pose.yaw;
      setTruckWheelAngle(truck, pose.wheelDistance / (.369 * .58)); setTruckCargoAccess(truck, pose.doors);
      world.payloads.get(vehicle.assetId)?.children.forEach((part, index) => { part.visible = index < pose.loaded; });
    }
    const working = snapshot.vehicles.find(v => v.motion === (time < 44000 ? 'loader-a' : 'queue-b'));
    if (working) {
      animateDepotActors(world.actors, depotYardPose(working, time), reduced || !running);
      const a = snapshot.vehicles.find(v => v.motion === 'loader-a');
      if (a) world.actors.loaded.forEach((part, index) => { part.visible = index < depotYardPose(a, time).loaded; });
      world.actors.root.visible = true;
    } else world.actors.root.visible = false;
    world.depot.roof.visible = !snapshot.interior;
    const bayTruck = snapshot.vehicles.find(v => v.resourceCode === 'BAY_02');
    const open = bayTruck && ['loading', 'docking', 'ready'].includes(bayTruck.phase) ? 1 : 0;
    world.depot.shutters[1].scale.y = 1 - open * .96; world.depot.shutters[1].position.y = .35 + 2.28 * open * .96;
    world.depot.barrier.rotation.x = time >= 43500 && time < 56000 ? -Math.PI / 2 : 0;
    world.depot.exitBarrier.rotation.x = time < 8000 || time >= 22000 && time < 40000 ? -Math.PI / 2 : 0;
    const selected = snapshot.vehicles.find(v => v.assetId === snapshot.selectedAssetId);
    const focused = selected && !['unknown', 'departed'].includes(selected.phase);
    const nextFocusKey = `${snapshot.selectedAssetId}:${snapshot.interior}:${size.width}:${size.height}`;
    if (focusKey.current !== nextFocusKey) { focusKey.current = nextFocusKey; guided.current = true; }
    if (guided.current) {
      const target = focusTarget.current;
      if (focused) target.copy(depotYardPose(selected, time).position).setY(.9);
      else target.set(snapshot.interior ? 2 : 0, .6, snapshot.interior ? -1 : 1);
      focusPosition.current.copy(target).add(new Vector3(-24, 25, 30));
      const blend = reduced || !running || snapshot.focusInstant ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 7);
      camera.position.lerp(focusPosition.current, blend); orbit.current?.target.lerp(target, blend);
      if (camera instanceof OrthographicCamera) { const zoom = Math.min(size.width / (focused ? 17 : snapshot.interior ? 37 : 49), size.height / (focused ? 14 : 35)); camera.zoom = MathUtils.lerp(camera.zoom, Math.max(3, zoom), blend); camera.updateProjectionMatrix(); }
    }
    orbit.current?.update(Math.min(delta, .05));
    // R3F owns rendering/resizing. Metrics describe the last completed frame.
    Object.assign(gl.domElement.dataset, {
      depotInstance: world.depot.root.uuid, depotTime: time.toFixed(0), depotSelected: snapshot.selectedAssetId ?? '',
      depotVehicles: String(snapshot.vehicles.filter(v => !['unknown', 'departed'].includes(v.phase)).length),
      frames: String(++frames.current), drawCalls: String(gl.info.render.calls), triangles: String(gl.info.render.triangles),
      geometries: String(gl.info.memory.geometries), textures: String(gl.info.memory.textures), dpr: String(gl.getPixelRatio()),
      cameraMode: focused ? 'selected' : 'overview', depotRoof: String(world.depot.roof.visible), motion: running ? 'running' : 'paused',
      depotTemplate: templateId, depotDesigns: snapshot.vehicles.map(vehicle => vehicle.designId).join(','),
    });
  });
  return <>
    <ambientLight intensity={.5 - night * .18}/><hemisphereLight args={['#edf7ff', '#8c967b', 1.4 - night * .6]}/>
    <directionalLight position={[-12, 22, 10]} intensity={2.7 - night * 1.5} color={night > .5 ? '#c4d9ff' : '#fff0d4'} castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-.0005} shadow-normalBias={.025}/>
    <pointLight position={[3, 4, 2]} color="#ffe2a4" intensity={night * 100} distance={18} decay={2}/>
    {world ? <><primitive object={world.depot.root} dispose={null}/>{[...world.trucks].map(([id, truck]) => <primitive key={id} object={truck} dispose={null} onClick={(event: { delta: number; stopPropagation: () => void }) => { if (event.delta <= 5) { event.stopPropagation(); controller.select(id); } }}/>)}</> : null}
  </>;
}
export default function DepotYardScene(props: Props) {
  return <Canvas orthographic shadows="percentage" dpr={[1, 1.5]} frameloop={props.active ? 'demand' : 'never'} camera={{ position: [-24, 25, 30], zoom: 14, near: .1, far: 180 }} gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.outputColorSpace = SRGBColorSpace; }}><Yard {...props}/></Canvas>;
}
