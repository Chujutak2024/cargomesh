import { Box3, Group, LoadingManager, Mesh, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { inspectTruckGlb } from "./truck-glb";

export function disposeTruckAsset(model: Group) {
  const textures = new Set<Texture>();
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) { texture.dispose(); const image = texture.source.data as { close?: () => void } | null; image?.close?.(); }
}
export async function loadTruckGlb(buffer: ArrayBuffer): Promise<Group> {
  inspectTruckGlb(buffer);
  const manager = new LoadingManager();
  manager.setURLModifier(url => {
    if (!url.startsWith("blob:") && !/^data:image\/(?:png|jpeg|webp);base64,/.test(url)) throw new Error("EXTERNAL_MODEL_FILE");
    return url;
  });
  const { scene } = await new GLTFLoader(manager).parseAsync(buffer, "");
  try {
    let pixels = 0;
    const textures = new Set<Texture>();
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const position = node.geometry.getAttribute("position");
      if (!position) throw new Error("INVALID_MODEL");
      for (const value of position.array) if (!Number.isFinite(value)) throw new Error("INVALID_MODEL");
      node.castShadow = node.receiveShadow = true;
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    });
    for (const texture of textures) {
      const image = texture.source.data as { width?: number; height?: number } | null;
      if (!image || typeof image.width !== "number" || typeof image.height !== "number"
        || image.width < 1 || image.height < 1 || image.width > 4096 || image.height > 4096) throw new Error("MODEL_COMPLEXITY");
      pixels += image.width * image.height;
    }
    if (pixels > 32 * 1024 * 1024) throw new Error("MODEL_COMPLEXITY");
    const bounds = new Box3().setFromObject(scene), size = bounds.getSize(new Vector3());
    if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0)) throw new Error("INVALID_MODEL");
    const scale = Math.min(7.2 / size.x, 2.7 / size.y, 2.7 / size.z);
    const center = bounds.getCenter(new Vector3());
    // Center and scale the imported asset without replacing its geometry.
    const offset = new Group(); offset.add(scene); offset.position.set(-center.x, -bounds.min.y, -center.z);
    const result = new Group(); result.add(offset); result.scale.setScalar(scale);
    result.userData.source = "custom-glb";
    return result;
  } catch (error) { disposeTruckAsset(scene); throw error; }
}
