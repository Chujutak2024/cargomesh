import { CarrierPortalAccessListV2Schema } from "../../shared/schemas/v2/carrier-portal";
import { parseCatalogRecordV2 } from "../../shared/schemas/v2/catalog";
import { portalRequest, PortalApiError } from "./api";

/** Membership and profile are both verified by the server before opening a workspace. */
export async function loadCarrierEntry(signal: AbortSignal, fetcher: typeof fetch = fetch) {
  signal.throwIfAborted();
  const response = await portalRequest("/api/v2/carrier-portal/access", { signal }, fetcher);
  signal.throwIfAborted();
  const access = CarrierPortalAccessListV2Schema.parse(response.data);
  if (access.length !== 1) return { access, profile: null };
  const id = access[0].carrierId;
  const loaded = await portalRequest("/api/v2/carrier-portal/carriers/" + id, { signal }, fetcher);
  signal.throwIfAborted();
  const profile = parseCatalogRecordV2("carriers", loaded.data);
  if (profile.id !== id) throw new PortalApiError(502, "INVALID_RESPONSE");
  return { access, profile };
}
