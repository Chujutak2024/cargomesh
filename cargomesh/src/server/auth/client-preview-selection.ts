/** A visual grant never replaces an authenticated Client or grants Carrier membership. */
export async function useClientPreview(
  member: () => Promise<unknown>, preview: () => Promise<boolean>,
): Promise<boolean> {
  try { await member(); return false; }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message.startsWith('FORBIDDEN:')) return false;
    if (!error.message.startsWith('UNAUTHENTICATED:')) throw error;
    return preview();
  }
}
