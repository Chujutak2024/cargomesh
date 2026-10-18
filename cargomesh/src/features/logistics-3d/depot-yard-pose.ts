import { Vector3 } from 'three';
import { depotCyclePose, ease } from './depot-cycle';
import type { YardVehicle } from './depot-coordinator';

/** Yard coordinates only; never latitude/longitude or an operational position. */
export function depotYardPose(vehicle: YardVehicle, elapsedMs: number) {
  const t = Math.max(0, elapsedMs / 1000);
  let cycle = 0;
  if (vehicle.motion === 'loader-a') cycle = t < 18 ? 42 + t / 18 * 15 : t < 22 ? 57 + (t - 18) / 4 * 5 : 62 + Math.min(1, (t - 22) / 18) * 10;
  if (vehicle.motion === 'queue-b') cycle = t < 44 ? 9 : t < 54 ? 9 + (t - 44) / 10 * 9 : t < 62 ? 18 + t - 54 : t < 68 ? 26 + (t - 62) / 6 * 10 : t < 89 ? 36 + t - 68 : 57 + Math.min(1, t - 89) * 5;
  const pose = depotCyclePose(cycle);
  if (!vehicle.motion) {
    pose.position = new Vector3(vehicle.slot[0], 0, vehicle.slot[1]);
    pose.yaw = vehicle.slot[2]; pose.wheelDistance = 0; pose.doors = 0;
  }
  if (vehicle.motion === 'exit-d') {
    const progress = ease(t / 8);
    pose.position = new Vector3(10.5 + progress * 8, 0, 9); pose.yaw = Math.PI;
    pose.wheelDistance = progress * 8; pose.doors = 0;
    pose.loaded = 3; pose.loadProgress = 1;
  }
  return { ...pose, visible: vehicle.phase !== 'unknown' && vehicle.phase !== 'departed' };
}
