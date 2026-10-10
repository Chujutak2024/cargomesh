/** Embedded glTF only: importing a truck must not request arbitrary external files. */
export const maxTruckModelBytes = 12 * 1024 * 1024;
export const truckModelIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_MODEL");
  return value as Record<string, unknown>;
};
const list = (value: unknown): Record<string, unknown>[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("INVALID_MODEL");
  return value.map(record);
};

export function inspectTruckGlb(buffer: ArrayBuffer) {
  if (buffer.byteLength < 28 || buffer.byteLength > maxTruckModelBytes) throw new Error("MODEL_SIZE");
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength) throw new Error("INVALID_MODEL");
  let offset = 12, json: Record<string, unknown> | null = null, binaryBytes = 0;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw new Error("INVALID_MODEL");
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > buffer.byteLength) throw new Error("INVALID_MODEL");
    if (!json) {
      if (type !== 0x4e4f534a || length > 2 * 1024 * 1024) throw new Error("INVALID_MODEL");
      json = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buffer, offset, length))));
    } else if (type === 0x004e4942) {
      if (binaryBytes) throw new Error("INVALID_MODEL");
      binaryBytes = length;
    } else throw new Error("INVALID_MODEL");
    offset += length;
  }
  if (!json || record(json.asset).version !== "2.0") throw new Error("INVALID_MODEL");
  const buffers = list(json.buffers), images = list(json.images), meshes = list(json.meshes);
  if (buffers.length !== 1 || buffers[0].uri !== undefined || typeof buffers[0].byteLength !== "number"
    || buffers[0].byteLength > binaryBytes || binaryBytes - buffers[0].byteLength > 3) throw new Error("EXTERNAL_MODEL_FILE");
  if (!meshes.length || meshes.length > 64 || images.length > 16 || list(json.nodes).length > 256
    || list(json.accessors).some(item => typeof item.count !== "number" || !Number.isInteger(item.count) || item.count < 0 || item.count > 1_500_000)) throw new Error("MODEL_COMPLEXITY");
  if (json.extensionsRequired !== undefined && (!Array.isArray(json.extensionsRequired)
    || json.extensionsRequired.some(extension => !["KHR_materials_unlit", "KHR_materials_clearcoat", "KHR_materials_ior", "KHR_materials_specular", "KHR_materials_transmission", "KHR_texture_transform"].includes(String(extension))))) throw new Error("UNSUPPORTED_MODEL");
  // Embedded raster textures only. Block SVG, relative paths and remote URLs.
  for (const image of images) {
    if (image.uri !== undefined && (typeof image.uri !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.uri))) throw new Error("EXTERNAL_MODEL_FILE");
    if (image.bufferView !== undefined && (!Number.isInteger(image.bufferView) || !["image/png", "image/jpeg", "image/webp"].includes(String(image.mimeType)))) throw new Error("INVALID_MODEL");
  }
  let triangles = 0, primitives = 0;
  const accessors = list(json.accessors);
  for (const mesh of meshes) for (const primitive of list(mesh.primitives)) {
    if (primitive.mode !== undefined && primitive.mode !== 4) throw new Error("UNSUPPORTED_MODEL");
    const index = primitive.indices ?? record(primitive.attributes).POSITION;
    if (typeof index !== "number" || !Number.isInteger(index) || !accessors[index]) throw new Error("INVALID_MODEL");
    triangles += Number(accessors[index].count) / 3; primitives++;
  }
  if (triangles < 1 || triangles > 200_000 || primitives > 64) throw new Error("MODEL_COMPLEXITY");
  // A single declared mesh can be repeated by many nodes. Bound the instantiated scene too.
  let instanceTriangles = 0, instanceMeshes = 0;
  for (const node of list(json.nodes)) {
    if (node.mesh === undefined) continue;
    if (typeof node.mesh !== "number" || !Number.isInteger(node.mesh) || !meshes[node.mesh]) throw new Error("INVALID_MODEL");
    for (const primitive of list(meshes[node.mesh].primitives)) {
      const index = primitive.indices ?? record(primitive.attributes).POSITION;
      instanceTriangles += Number(accessors[Number(index)].count) / 3; instanceMeshes++;
    }
  }
  if (instanceTriangles > 200_000 || instanceMeshes > 64) throw new Error("MODEL_COMPLEXITY");
  return { triangles, meshes: primitives, bytes: buffer.byteLength };
}
