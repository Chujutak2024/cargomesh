import { Vector3 } from "three";
import type { ScenicRoadCurve, continuousScenicRoad } from "../logistics-3d/scenic-route-model";

/** Original decorative road. No itinerary, shipment state or map provider is involved. */
export function createEntranceRoad(): ReturnType<typeof continuousScenicRoad> {
  const lateral = (distance: number) => 18 * Math.sin(distance / 180) + 7 * Math.sin(distance / 63);
  const slope = (distance: number) => .1 * Math.cos(distance / 180) + 7 / 63 * Math.cos(distance / 63);
  const centerAt = (distance: number) => new Vector3(lateral(distance), 0, -distance);
  const tangentAt = (distance: number) => new Vector3(slope(distance), 0, -1).normalize();
  const poseAt = (distance: number) => {
    const center = centerAt(distance), tangent = tangentAt(distance), normal = new Vector3(-tangent.z, 0, tangent.x);
    return { center, tangent, normal, point: center.clone().addScaledVector(normal, 2.5), angle: Math.atan2(tangent.z, -tangent.x) };
  };
  const section = (from: number, to: number, origin = new Vector3()): ScenicRoadCurve => ({
    getLength: () => to - from,
    getPointAt: fraction => centerAt(from + fraction * (to - from)).sub(origin),
    getTangentAt: fraction => tangentAt(from + fraction * (to - from)),
  });
  const offsetAt = (x: number, z: number) => {
    let distance = -z;
    for (let step = 0; step < 4; step++) {
      const dx = lateral(distance) - x, derivative = slope(distance);
      const second = -.1 / 180 * Math.sin(distance / 180) - 7 / (63 * 63) * Math.sin(distance / 63);
      distance -= (dx * derivative + distance + z) / (1 + derivative * derivative + dx * second);
    }
    const tangent = tangentAt(distance), dx = x - lateral(distance), dz = z + distance;
    return dx * -tangent.z + dz * tangent.x;
  };
  return { length: 1200, centerAt, poseAt, section, offsetAt };
}
