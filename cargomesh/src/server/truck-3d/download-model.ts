import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { inspectTruckGlb, maxTruckModelBytes } from "@/features/logistics-3d/truck-glb";

export function isPublicModelAddress(address: string) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return false;
  const [a, b, c, d] = address.split(".").map(Number);
  if ([a,b,c,d].some(value=>value>255)) return false;
  return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a===169&&b===254)
    && !(a===172&&b>=16&&b<=31) && !(a===192&&b===168) && !(a===100&&b>=64&&b<=127)
    && !(a===198&&(b===18||b===19)) && !(a===192&&b===0) && !(a===198&&b===51&&c===100)
    && !(a===203&&b===0&&c===113);
}
/** Pin a checked public address. Never follow redirects or forward API credentials. */
export async function downloadTruckModel(value: string): Promise<Blob> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") throw new Error("MODEL_DOWNLOAD");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(item => !isPublicModelAddress(item.address))) throw new Error("MODEL_DOWNLOAD");
  const address = addresses[0].address;
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const request = get(url, { timeout: 20_000, family: 4, lookup: (_hostname, _options, callback) => callback(null, address, 4) }, response => {
      if (response.statusCode !== 200 || Number(response.headers["content-length"] ?? 0) > maxTruckModelBytes) { response.destroy(); reject(new Error("MODEL_DOWNLOAD")); return; }
      let bytes = 0; const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > maxTruckModelBytes) { response.destroy(); reject(new Error("MODEL_SIZE")); } else chunks.push(chunk); });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", () => reject(new Error("MODEL_DOWNLOAD")));
      response.on("aborted", () => reject(new Error("MODEL_DOWNLOAD")));
    });
    request.on("timeout", () => request.destroy(new Error("MODEL_DOWNLOAD")));
    request.on("error", () => reject(new Error("MODEL_DOWNLOAD")));
  });
  const bytes = Uint8Array.from(buffer).buffer;
  inspectTruckGlb(bytes);
  return new Blob([bytes], { type: "model/gltf-binary" });
}
