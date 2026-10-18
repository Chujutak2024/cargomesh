'use client';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Color, Fog, Group, PMREMGenerator, SRGBColorSpace, Vector3 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Pause, Play, Route } from 'lucide-react';
import { useReducedMotionPreference } from '@/features/product-motion/use-motion-preference';
import { buildCargoMeshTruck, disposeCargoMeshTruck, setTruckWheelAngle } from './truck-model';
import { buildScenicRouteWorld, disposeScenicWorld } from './scenic-route-world';
import { buildScenicRouteSky } from './scenic-route-sky';
import { visualTripCircuit, visualTripPose } from './visual-trip-model';
import { truckDesign } from './visual-catalog';
import { getTruckEnvironment } from './truck-environment';
import { buildDepotActors } from './depot-actors';
import { disposeDepot } from './depot-model';
import type { YardVehicle } from './depot-coordinator';
import type { TruckEnvironment } from './truck-environment';
import s from './visual-trip.module.css';

export type VisualTripClock = { distance: number; requestedPlay: boolean | null };
class Boundary extends Component<{ children: ReactNode; failed: () => void }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.failed(); } render() { return this.state.failed ? null : this.props.children; }
}
function TripWorld({ vehicle, siteId, clock, active, running, environment, ready, failed }: { vehicle: YardVehicle; siteId: string; clock: VisualTripClock; active: boolean; running: boolean; environment: TruckEnvironment; ready: () => void; failed: () => void }) {
  const { gl, scene, camera, invalidate } = useThree();
  const [world, setWorld] = useState<{ truck: Group; terrain: ReturnType<typeof buildScenicRouteWorld>; curve: ReturnType<typeof visualTripCircuit>; sky: ReturnType<typeof buildScenicRouteSky> } | null>(null);
  const placed = useRef(false), frameCount = useRef(0), target = useRef(new Vector3());
  useEffect(() => {
    const curve = visualTripCircuit(), terrain = buildScenicRouteWorld(curve, 'countryside', { guide: true, signs: false, heightAt: () => -.12 });
    const truck = buildCargoMeshTruck(vehicle.family, { appearance: truckDesign(vehicle.designId)?.appearance, designId: vehicle.designId });
    const sky = buildScenicRouteSky(getTruckEnvironment(new Date()));
    const cargo = vehicle.cargo ? buildDepotActors(vehicle.family) : null;
    if (cargo) { cargo.payload.children.forEach(part => { part.visible = true; }); truck.add(cargo.payload); }
    setWorld({ truck, terrain, curve, sky }); placed.current = false;
    return () => { if (cargo) { truck.remove(cargo.payload); cargo.root.add(cargo.payload); disposeDepot(cargo.root); } disposeCargoMeshTruck(truck); disposeScenicWorld(terrain.root); sky.dispose(); };
  }, [vehicle.assetId, vehicle.family, vehicle.designId, vehicle.cargo]);
  // A paused demand canvas needs a frame after the primitives are committed.
  // Invalidating before setWorld commits can leave only the initial ground drawn.
  useEffect(() => { if (world && active) { invalidate(2); ready(); } }, [world, active, invalidate, ready]);
  useEffect(() => {
    const generator = new PMREMGenerator(gl), room = new RoomEnvironment(), map = generator.fromScene(room, .05, .1, 100, { size: 128 });
    scene.environment = map.texture; room.dispose(); generator.dispose();
    return () => { scene.environment = null; map.dispose(); };
  }, [gl, scene]);
  useEffect(() => {
    scene.background = new Color(environment.skyHorizon); scene.fog = new Fog(environment.skyHorizon, 50, 145);
    scene.environmentIntensity = .6 - environment.night * .4; invalidate();
  }, [scene, environment, invalidate]);
  useEffect(() => {
    const node = gl.domElement; node.addEventListener('webglcontextlost', failed);
    return () => node.removeEventListener('webglcontextlost', failed);
  }, [gl, failed]);
  useEffect(() => { if (active) invalidate(); if (!active || !running) return; const timer = window.setInterval(invalidate, 1000 / 30); return () => window.clearInterval(timer); }, [active, running, invalidate]);
  useFrame((_, delta) => {
    if (!world) return;
    if (running && active) clock.distance += Math.min(delta, .05) * 7;
    const pose = visualTripPose(world.curve, clock.distance);
    world.truck.position.copy(pose.point).setY(.09); world.truck.rotation.y = pose.angle;
    setTruckWheelAngle(world.truck, clock.distance / .369);
    target.current.copy(pose.point).addScaledVector(pose.tangent, -12).addScaledVector(pose.normal, -3); target.current.y = 6.3;
    camera.position.lerp(target.current, placed.current && running ? 1 - Math.exp(-delta * 6) : 1);
    camera.lookAt(pose.point.clone().addScaledVector(pose.tangent, 9).setY(1.3)); placed.current = true;
    world.terrain.update(clock.distance / 7, environment.night); world.sky.update(clock.distance / 7, environment);
    Object.assign(gl.domElement.dataset, { assetId: vehicle.assetId, siteId, tripId: vehicle.tripId ?? '', designId: vehicle.designId ?? '', distance: clock.distance.toFixed(2), source: 'ORIGINAL_SCENIC_CIRCUIT', frames: String(++frameCount.current), drawCalls: String(gl.info.render.calls), triangles: String(gl.info.render.triangles), geometries: String(gl.info.memory.geometries), textures: String(gl.info.memory.textures) });
  });
  return <>
    <hemisphereLight args={[environment.skyTop, '#68704a', environment.ambient * 1.5]}/>
    <directionalLight position={[-40, 65, 30]} intensity={environment.key} color={environment.sun} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-camera-far={240} shadow-normalBias={.04}/>
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0,-.14,-60]} receiveShadow><planeGeometry args={[650,650]}/><meshStandardMaterial color="#6d8c50" roughness={.95}/></mesh>
    {world ? <><primitive object={world.terrain.root} dispose={null}/><primitive object={world.sky.dome} dispose={null}/><primitive object={world.truck} dispose={null}/></> : null}
  </>;
}
type VisualTripProps = { vehicle: YardVehicle; siteId: string; clock: VisualTripClock };
export function VisualTrip(props: VisualTripProps) {
  if (!props.vehicle.tripId || ['maintenance', 'unknown'].includes(props.vehicle.phase)) return <section className={s.root}><h2>No trip to preview</h2><p className={s.note}>{props.vehicle.label} {props.vehicle.phase === 'maintenance' ? 'remains blocked in maintenance.' : props.vehicle.phase === 'unknown' ? 'has no known location.' : 'has no assigned visual trip.'} Return to Yard to inspect the vehicle. No movement is created for this selection.</p></section>;
  return <VisualTripContent {...props}/>;
}
function VisualTripContent({ vehicle, siteId, clock }: VisualTripProps) {
  const reduced = useReducedMotionPreference(), host = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(clock.requestedPlay), [active, setActive] = useState(false), [visible, setVisible] = useState(false), [error, setError] = useState(false), [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0);
  const [environment, setEnvironment] = useState(() => getTruckEnvironment(new Date()));
  const ready = useRef(() => setLoaded(true)).current, failed = useRef(() => setError(true)).current;
  const running = requested ?? !reduced;
  useEffect(() => { const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting))); if (host.current) observer.observe(host.current); return () => observer.disconnect(); }, []);
  useEffect(() => { const update = () => { setActive(visible && !document.hidden); if (!document.hidden) setEnvironment(getTruckEnvironment(new Date())); }; update(); document.addEventListener('visibilitychange', update); const timer = window.setInterval(update, 30000); return () => { document.removeEventListener('visibilitychange', update); window.clearInterval(timer); }; }, [visible]);
  useEffect(() => { if (!visible || loaded || error) return; const timer = window.setTimeout(failed, 12000); return () => window.clearTimeout(timer); }, [visible, loaded, error, retry, failed]);
  return <section className={s.root} aria-label="Scenic trip preview">
    <header><Route size={23}/><div><h2>{vehicle.label} · Scenic trip</h2><p>Original visual circuit · No geographic route or GPS</p></div><button aria-pressed={running} onClick={() => { clock.requestedPlay = !running; setRequested(!running); }}>{running ? <Pause size={16}/> : <Play size={16}/>} {running ? 'Pause visualization' : 'Resume visualization'}</button></header>
    <div ref={host} className={s.stage}>{visible && !error ? <Boundary key={retry} failed={failed}><Canvas frameloop={active ? 'demand' : 'never'} shadows="percentage" dpr={[1,1.5]} camera={{ fov: 48, near: .1, far: 1200 }} gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.outputColorSpace = SRGBColorSpace; }}><TripWorld vehicle={vehicle} siteId={siteId} clock={clock} active={active} running={running} environment={environment} ready={ready} failed={failed}/></Canvas></Boundary> : null}
      {error ? <div className={s.fallback} role="alert"><strong>The 3D trip is unavailable</strong><p>The selected identity and visual distance are retained.</p><button onClick={() => { setLoaded(false); setError(false); setRetry(value => value + 1); }}>Retry trip</button></div> : !loaded ? <span className={s.loading} role="status">Preparing the scenery…</span> : null}</div>
    <dl className={s.identities}><div><dt>Asset</dt><dd>{vehicle.assetId}</dd></div><div><dt>Site</dt><dd>{siteId}</dd></div><div><dt>Trip</dt><dd>{vehicle.tripId ?? 'Not assigned'}</dd></div></dl>
    <p className={s.note}>The same visual identities and design are retained from the yard. This circuit does not establish a delivery route, access permission or shipment progress.</p>
  </section>;
}
