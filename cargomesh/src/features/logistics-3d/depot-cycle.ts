import { CatmullRomCurve3, Vector3 } from "three";

export const DEPOT_CYCLE_SECONDS = 72;
export type DepotPhase = "approach" | "check" | "yard" | "reverse" | "prepare" | "load" | "verify" | "depart" | "complete";
export const depotPhases: { id: DepotPhase; start: number; label: string }[] = [
  { id: "approach", start: 0, label: "Llegada a la sede" },
  { id: "check", start: 6, label: "Control de acceso" },
  { id: "yard", start: 9, label: "Entrada al patio" },
  { id: "reverse", start: 18, label: "Atraque al muelle" },
  { id: "prepare", start: 26, label: "Preparación del pedido" },
  { id: "load", start: 36, label: "Carga del camión" },
  { id: "verify", start: 57, label: "Revisión de salida" },
  { id: "depart", start: 62, label: "Salida de la sede" },
  { id: "complete", start: 72, label: "Operación terminada" },
];
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => { const x = clamp01(n); return x*x*(3-2*x); };
const curve = (points: number[][]) => new CatmullRomCurve3(points.map(([x,z]) => new Vector3(x,0,z)), false, "centripetal");
const approach = curve([[-18,9],[-10.8,9],[-5,9],[-1,9],[1.9,9],[3,9.3],[3,9.8]]);
const departures=[3.7,2.77].map(z=>curve([[3,z],[3,6],[3,8.7],[4.8,9.5],[10,9],[18,9]]));
const entryLength = approach.getLength();
export function depotCyclePose(seconds: number, compact = false) {
  const departure=departures[compact?1:0],dockZ=compact?2.77:3.7;
  const time = Math.max(0, Math.min(DEPOT_CYCLE_SECONDS, seconds));
  const phase = depotPhases.findLast(item => time >= item.start)!.id;
  const checkFraction = .25;
  const fraction = time < 6 ? ease(time/6)*checkFraction : time < 9 ? checkFraction : time < 18 ? checkFraction + ease((time-9)/9)*(1-checkFraction) : 1;
  let position = approach.getPointAt(fraction), heading = approach.getTangentAt(fraction), wheelDistance = entryLength*fraction;
  if (time >= 18) {
    const reverse = ease((time-18)/8);
    position = new Vector3(3,0,9.8-(9.8-dockZ)*reverse); heading = new Vector3(0,0,1); wheelDistance -= (9.8-dockZ)*reverse;
  }
  if (time >= 62) {
    const out = ease((time-62)/10);
    position = departure.getPointAt(out); heading = departure.getTangentAt(out); wheelDistance += departure.getLength()*out;
  }
  const gate = time < 6 ? 0 : time < 7.5 ? ease((time-6)/1.5) : time < 14 ? 1 : 1-ease((time-14)/1.5);
  const loadProgress = clamp01((time-36)/21);
  const loaded = Math.min(3, Math.floor(loadProgress*3));
  const loading = phase === "load";
  const trip = Math.min(2, Math.floor(clamp01((time-36)/21)*3));
  const tripTime = loading ? (time-36-trip*7)/7 : 0;
  const doors = ease((time-25)/2)*(1-ease((time-57)/3));
  return { time, phase, position, yaw: Math.atan2(heading.z,-heading.x), wheelDistance,
    progress: time/DEPOT_CYCLE_SECONDS, gate, exitGate: ease((time-63)/1.5)*(1-ease((time-70)/1.5)),
    prepared: Math.min(3, Math.floor(clamp01((time-26)/10)*3)), loaded, loadProgress, loading, trip, tripTime, doors };
}
export type DepotPose = ReturnType<typeof depotCyclePose>;

/** Forks travel through the open dock, then retract before the truck can leave. */
export function loadingVehiclePose(pose: DepotPose) {
  const p = pose.tripTime;
  const run = p < .48 ? ease(p/.48) : p < .7 ? 1 : 1-ease((p-.7)/.3);
  const delivery = ease((p-.5)/.16);
  return { x: 3, z: -4.6+4.8*run, yaw: p < .7 ? Math.PI : 0,
    lift: .12 + .38*ease((p-.28)/.16), carrying: pose.loading && p < .66,
    transfer: delivery, moving: pose.loading && (p < .48 || p > .7) };
}
