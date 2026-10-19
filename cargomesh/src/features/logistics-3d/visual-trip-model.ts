import { CatmullRomCurve3, Vector3 } from 'three';
import { scenicRoadPose } from './scenic-route-model';
/** Original closed circuit in arbitrary scene units. No map provider geography. */
export function visualTripCircuit() {
  return new CatmullRomCurve3([
    new Vector3(0, 0, 0), new Vector3(-65, 0, -20), new Vector3(-90, 0, -90),
    new Vector3(-30, 0, -140), new Vector3(55, 0, -110), new Vector3(80, 0, -40),
  ], true, 'centripetal');
}
export function visualTripPose(curve: ReturnType<typeof visualTripCircuit>, distance: number) {
  const length = curve.getLength(), progress = ((distance % length) + length) % length / length;
  return scenicRoadPose(curve, progress);
}
