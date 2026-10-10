import { inspectTruckGlb, truckModelIdPattern } from "./truck-glb";

type StoredModel = { id: string; blob: Blob; source: "imported" | "photo"; savedAt: string };
const store = "models";
function openModels(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("cargomesh-truck-models-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("MODEL_STORAGE"));
    request.onblocked = () => reject(new Error("MODEL_STORAGE"));
  });
}
export async function storeTruckModel(blob: Blob, source: StoredModel["source"] = "imported") {
  inspectTruckGlb(await blob.arrayBuffer());
  const entry: StoredModel = { id: crypto.randomUUID(), blob, source, savedAt: new Date().toISOString() };
  const database = await openModels();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(store, "readwrite");
      transaction.objectStore(store).add(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("MODEL_STORAGE"));
    });
    return entry.id;
  } finally { database.close(); }
}
export async function readTruckModel(id: string): Promise<StoredModel | null> {
  if (!truckModelIdPattern.test(id)) return null;
  const database = await openModels();
  try {
    const entry = await new Promise<StoredModel | undefined>((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("MODEL_STORAGE"));
    });
    if (!entry || !(entry.blob instanceof Blob)) return null;
    inspectTruckGlb(await entry.blob.arrayBuffer());
    return entry;
  } finally { database.close(); }
}
