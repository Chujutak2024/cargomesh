import { CatmullRomCurve3, Vector3, type Curve } from "three";
import type { RouteTrack } from "./route-track";
import { routePointAt } from "./route-track";
export type RouteLandscape = "coast" | "mountains" | "city" | "countryside";
/** Original interpretive landscape, not surveyed buildings, terrain or provider map tiles. */
export function routeLandscape(origin: string, destination: string): RouteLandscape {
  const route = `${origin} ${destination}`.toLowerCase();
  if (/arequipa|santiago|buenos|monterrey|méxico|mexico/.test(route)) return "mountains";
  if (/madrid|barcelona/.test(route)) return "city";
  if (/callao|lima|piura|trujillo|chiclayo/.test(route)) return "coast";
  return "countryside";
}
export const landscapeLabels = { coast: "Corredor costero", mountains: "Carretera de montaña", city: "Acceso urbano", countryside: "Paisaje rural" };
/** Compress distances for an illustrative 3D journey while retaining route bends/direction. */
export function scenicRouteCurve(track: RouteTrack) {
  const first = track.points[0], scale = 2200 / track.total, cos = Math.cos(first.lat * Math.PI / 180);
  const points = Array.from({ length: 161 }, (_, index) => {
    const point = routePointAt(track, track.total * index / 160);
    const longitude = ((point.lng - first.lng + 540) % 360) - 180;
    return new Vector3(longitude * 111320 * cos * scale, 0, -(point.lat - first.lat) * 111320 * scale);
  });
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  curve.arcLengthDivisions = 3000;
  return curve;
}
export type ScenicRoadCurve = Pick<Curve<Vector3>, "getPointAt" | "getTangentAt" | "getLength">;
export function scenicRoadPose(curve: ScenicRoadCurve, progress: number) {
  const value = Math.max(0, Math.min(1, progress)), center = curve.getPointAt(value), tangent = curve.getTangentAt(value).normalize();
  const normal = new Vector3(-tangent.z, 0, tangent.x);
  return { center, tangent, normal, point: center.clone().addScaledVector(normal, 2.5), angle: Math.atan2(tangent.z, -tangent.x) };
}

export const SCENIC_CHUNK_LENGTH = 320;
/** Four bounded chunks: the next join is prepared beyond the fog, never at the camera. */
export function scenicChunkIndices(cursor: number) {
  const current = Math.floor(cursor / SCENIC_CHUNK_LENGTH);
  return [current - 1, current, current + 1, current + 2];
}

/**
 * The known route drives the initial scenery. Beyond it, an original visual road
 * continues with the same position/tangent. This cursor is neither GPS nor
 * shipment progress; the geographic map keeps its unmodified provider geometry.
 */
export function continuousScenicRoad(curve: ScenicRoadCurve, landscape: RouteLandscape) {
  const length = curve.getLength(), start = scenicRoadPose(curve, 0), end = scenicRoadPose(curve, 1);
  const amplitude = landscape === "city" ? 12 : landscape === "mountains" ? 34 : 24;
  const centerAt = (cursor: number) => {
    if (cursor < 0) return start.center.clone().addScaledVector(start.tangent, cursor);
    if (cursor <= length) return curve.getPointAt(cursor / length);
    const distance = cursor - length;
    const lateral = amplitude * (1 - Math.cos(distance / 120)) + 11 * (1 - Math.cos(distance / 271));
    return end.center.clone().addScaledVector(end.tangent, distance).addScaledVector(end.normal, lateral);
  };
  const tangentAt = (cursor: number) => {
    if (cursor < 0) return start.tangent.clone();
    if (cursor <= length) return curve.getTangentAt(cursor / length).normalize();
    const distance = cursor - length;
    const derivative = amplitude / 120 * Math.sin(distance / 120) + 11 / 271 * Math.sin(distance / 271);
    return end.tangent.clone().addScaledVector(end.normal, derivative).normalize();
  };
  const section = (from: number, to: number, origin = new Vector3()): ScenicRoadCurve => ({
    getLength: () => to - from,
    getPointAt: value => centerAt(from + value * (to - from)).sub(origin),
    getTangentAt: value => tangentAt(from + value * (to - from)),
  });
  const poseAt = (cursor: number) => {
    const center = centerAt(cursor), tangent = tangentAt(cursor), normal = new Vector3(-tangent.z, 0, tangent.x);
    return { center, tangent, normal, point: center.clone().addScaledVector(normal, 2.5), angle: Math.atan2(tangent.z, -tangent.x) };
  };
  // A world-space terrain field avoids folding wide strips around tight road bends.
  const samples = Array.from({ length: 257 }, (_, index) => curve.getPointAt(index / 256));
  const offsetAt = (x: number, z: number) => {
    let nearest = Infinity, signed = 0;
    const consider = (cx: number, cz: number, tx: number, tz: number) => {
      const dx = x - cx, dz = z - cz, square = dx * dx + dz * dz;
      if (square < nearest) { nearest = square; signed = Math.sqrt(square) * (dx * -tz + dz * tx < 0 ? -1 : 1); }
    };
    for (let index = 1; index < samples.length; index++) {
      const a = samples[index - 1], b = samples[index], dx = b.x - a.x, dz = b.z - a.z, square = dx * dx + dz * dz;
      const value = square ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / square)) : 0;
      consider(a.x + dx * value, a.z + dz * value, dx, dz);
    }
    const behind = (x - start.center.x) * start.tangent.x + (z - start.center.z) * start.tangent.z;
    if (behind < 0) consider(start.center.x + start.tangent.x * behind, start.center.z + start.tangent.z * behind, start.tangent.x, start.tangent.z);
    const forward = (x - end.center.x) * end.tangent.x + (z - end.center.z) * end.tangent.z;
    const sideways = (x - end.center.x) * end.normal.x + (z - end.center.z) * end.normal.z;
    let distance = Math.max(0, forward);
    for (let iteration = 0; iteration < 4; iteration++) {
      const lateral = amplitude * (1 - Math.cos(distance / 120)) + 11 * (1 - Math.cos(distance / 271));
      const derivative = amplitude / 120 * Math.sin(distance / 120) + 11 / 271 * Math.sin(distance / 271);
      const second = amplitude / 14400 * Math.cos(distance / 120) + 11 / 73441 * Math.cos(distance / 271);
      distance = Math.max(0, distance - (distance - forward + (lateral - sideways) * derivative) / Math.max(.5, 1 + derivative * derivative + (lateral - sideways) * second));
    }
    const p = centerAt(length + distance), t = tangentAt(length + distance); consider(p.x, p.z, t.x, t.z);
    return signed;
  };
  return { length, centerAt, poseAt, section, offsetAt };
}
