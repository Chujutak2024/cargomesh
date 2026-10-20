/** A visual grant never replaces an authenticated Client or grants Carrier membership. */
export async function useClientPreview(
  member: () => Promise<unknown>, preview: () => Promise<boolean>,
  assignedCarrierPreview: () => Promise<boolean> = async () => false,
): Promise<boolean> {
  try { await member(); return false; }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message.startsWith('FORBIDDEN:')) return assignedCarrierPreview();
    if (!error.message.startsWith('UNAUTHENTICATED:')) throw error;
    return preview();
  }
}
