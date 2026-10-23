/** Transcript hints never override authenticated Carrier or stored offer facts. */
export function voiceSessionContext(turns: readonly string[], role: "shipper" | "shipper_offers" | "carrier"): string[] {
  if (role === "carrier") return [];
  // Intake sends up to four early cargo anchors followed by twelve recent turns.
  // Keep that whole bounded envelope; slicing to twelve discards every anchor.
  return turns.slice(role === "shipper_offers" ? -6 : -16)
    .map(turn => turn.slice(0, role === "shipper_offers" ? 160 : 180));
}
