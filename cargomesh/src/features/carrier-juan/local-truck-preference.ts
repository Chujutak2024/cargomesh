/** Local equipment preference. This is not a fleet asset, booking or capacity check. */
export const truckTypes = [
  { id: "rigid", es: "Camión rígido", en: "Rigid truck", detailEs: "Caja cerrada", detailEn: "Enclosed box" },
  { id: "articulated", es: "Tracto con remolque", en: "Tractor with trailer", detailEs: "Unidad articulada", detailEn: "Articulated combination" },
  { id: "refrigerated", es: "Refrigerado", en: "Refrigerated truck", detailEs: "Carrocería refrigerada", detailEn: "Refrigerated body" },
  { id: "flatbed", es: "Plataforma", en: "Flatbed truck", detailEs: "Plataforma abierta", detailEn: "Open platform" },
  { id: "tipper", es: "Volquete", en: "Tipper truck", detailEs: "Caja basculante", detailEn: "Tipping body" },
  { id: "tanker", es: "Cisterna", en: "Tanker", detailEs: "Tanque para líquidos", detailEn: "Liquid tank" },
  { id: "mixer", es: "Mezclador", en: "Concrete mixer", detailEs: "Tambor de concreto", detailEn: "Concrete drum" },
  { id: "curtainsider", es: "Lona lateral", en: "Curtainsider", detailEs: "Cortinas deslizantes", detailEn: "Sliding curtains" },
  { id: "lowloader", es: "Cama baja", en: "Low loader", detailEs: "Transporte de maquinaria", detailEn: "Machinery transport" },
  { id: "logging", es: "Maderero", en: "Logging truck", detailEs: "Racks para madera", detailEn: "Timber racks" },
] as const;

export type CatalogTruckType = typeof truckTypes[number]["id"];
export type TruckPreference = { type: CatalogTruckType | "custom"; model: string; photoDataUrl: string | null; modelAssetId?: string | null };
export const maxTruckPhotoBytes = 8 * 1024 * 1024;
export const maxStoredTruckPhotoLength = 400_000;
export const acceptedTruckPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

export function truckLabel(value: TruckPreference | null, locale: "es" | "en"): string {
  if (!value) return locale === "es" ? "Sin preferencia" : "No preference";
  if (value.type === "custom") return value.model.trim() || (locale === "es" ? "Mi camión" : "My truck");
  return truckTypes.find(item => item.id === value.type)![locale];
}

export function truckImage(value: TruckPreference | null): string {
  return value?.type === "custom" ? value.photoDataUrl ?? "/v2-workspace/trucks/rigid.svg"
    : value ? `/v2-workspace/trucks/${value.type}-3d.png` : "/v2-workspace/truck-hero.png";
}

/** Only bounded raster data URLs created locally are restored. No remote URL or SVG. */
export function readTruckPreference(value: unknown): TruckPreference | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "custom" && !truckTypes.some(item => item.id === record.type)) return null;
  if (record.type !== "custom") return { type: record.type as CatalogTruckType, model: "", photoDataUrl: null };
  const model = typeof record.model === "string" ? record.model.slice(0, 80) : "";
  const photo = typeof record.photoDataUrl === "string" && record.photoDataUrl.length <= maxStoredTruckPhotoLength
    && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(record.photoDataUrl)
    ? record.photoDataUrl : null;
  const modelAssetId = typeof record.modelAssetId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.modelAssetId) ? record.modelAssetId : null;
  return { type: "custom", model, photoDataUrl: photo, ...(modelAssetId ? { modelAssetId } : {}) };
}

export function truckPhotoIssue(file: { type: string; size: number }): "format" | "size" | null {
  if (!acceptedTruckPhotoTypes.includes(file.type)) return "format";
  return file.size > maxTruckPhotoBytes ? "size" : null;
}
