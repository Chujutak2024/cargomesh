import {CARRIER_WORKSPACE_ENTRY,loginDestination,safeLoginReturnTo,type CarrierPortalAccessV2} from "../../shared/schemas/v2/carrier-portal";

type AccessReads = {
  member: () => Promise<boolean>;
  carriers: () => Promise<CarrierPortalAccessV2[]>;
};

/** Called only after the server validates the user. Reads use that same request's client. */
export async function resolveLoginAccess(preferred: unknown, reads: AccessReads) {
  // Start the independent carrier read immediately; settle failures to avoid
  // an unhandled rejection when a shipper member doesn't need its result.
  const carriers = Promise.resolve().then(reads.carriers).then(
    data => ({ok: true as const, data}),
    error => ({ok: false as const, error}),
  );
  const hasMember = await reads.member();
  if (hasMember && safeLoginReturnTo(preferred) !== "/carrier-portal" && safeLoginReturnTo(preferred) !== CARRIER_WORKSPACE_ENTRY) {
    return loginDestination(preferred, true, []);
  }
  const result = await carriers;
  if (!result.ok) throw result.error;
  return loginDestination(preferred, hasMember, result.data);
}
