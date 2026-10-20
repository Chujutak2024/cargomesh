import { Box3, OrthographicCamera, Vector3 } from 'three';

export type DepotCameraState = {
  position: [number, number, number]; target: [number, number, number]; zoom: number;
  guided: boolean; focusKey: string;
};

/** Frame actual architecture, including tall silos and the perimeter road. */
export function depotOverview(bounds: Box3, width: number, height: number) {
  const target = bounds.getCenter(new Vector3());
  const position = target.clone().add(new Vector3(-24, 25, 30));
  const camera = new OrthographicCamera(); camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld(true);
  let horizontal = 0, vertical = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    horizontal = Math.max(horizontal, Math.abs(corner.x)); vertical = Math.max(vertical, Math.abs(corner.y));
  }
  const zoom = Math.max(3, Math.min(100, .9 * Math.min(Math.max(1, width) / (horizontal * 2), Math.max(1, height) / (vertical * 2))));
  return { position, target, zoom };
}
