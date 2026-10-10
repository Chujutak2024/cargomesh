import type { WorkflowChatRecord } from "./workflow-chat-client";

export function summarizeWorkflow(kind: "offers" | "bookings" | "executions", records: WorkflowChatRecord[]): string {
  if (kind === "offers") {
    const offers = records.filter((record): record is Extract<WorkflowChatRecord, { kind: "offers" }> => record.kind === "offers")
      .filter((record) => record.data.status === "RECEIVED" && Date.parse(record.data.validity.endsAt) > Date.now());
    if (!offers.length) return "There is no current carrier-authored offer for this request. The ROAD check is preliminary; it is not a quote. You can check again after a carrier responds.";
    return `I found ${offers.length} current carrier-authored offer${offers.length === 1 ? "" : "s"}: ${offers.slice(0, 3).map((offer) => {
      const quoted = offer.data.breakdown.filter((part) => part.treatment === "QUOTED")
        .map((part) => `${part.kind.toLowerCase()} ${part.amount?.amount.toFixed(2) ?? "unknown"}`)
        .join(", ");
      const terms = offer.data.commercialTerms.map((term) => term.description).join("; ") || "no additional terms recorded";
      return `${offer.data.carrierReference}: ${offer.data.price.amount.toFixed(2)} ${offer.data.price.currency}; quoted components ${quoted}; estimated delivery ${offer.data.estimatedDeliveryAt ?? "unknown"}; terms ${terms}; valid until ${offer.data.validity.endsAt}; offer version ${offer.data.offerVersion}`;
    }).join(" | ")}. These are carrier offers, not confirmed bookings. Review all evidence and explicitly select a current offer in the shipper workflow; I cannot authorize a booking from this chat.`;
  }
  if (kind === "bookings") {
    const bookings = records.filter((record) => record.kind === "bookings");
    if (!bookings.length) return "No booking is recorded for this request. A shipper must select a current offer and explicitly authorize a booking; the carrier must confirm it separately.";
    const statuses = bookings.slice(0, 3).map((booking) => {
      const carrier = booking.data.carrierConfirmationStatus;
      const shipper = booking.data.authorizationStatus;
      const detail = carrier === "CONFIRMED" ? "the carrier confirmed this booking"
        : carrier === "CANCELLED" ? "this booking was cancelled"
        : carrier === "REJECTED" ? "the carrier rejected this booking"
        : "carrier confirmation is pending";
      return `${booking.id.slice(0, 8)}: shipper ${shipper.toLowerCase()}, carrier ${carrier.toLowerCase()} (${detail})`;
    }).join("; ");
    const hasPending = bookings.some((booking) => booking.data.carrierConfirmationStatus === "PENDING");
    return `I found ${bookings.length} booking record${bookings.length === 1 ? "" : "s"}: ${statuses}.${hasPending ? " Shipper authorization is not carrier confirmation." : ""}`;
  }
  const executions = records.filter((record) => record.kind === "executions");
  if (!executions.length) return "There is no recorded execution for this request yet. I cannot infer a live location or delivery status.";
  return `I found ${executions.length} execution record${executions.length === 1 ? "" : "s"}: ${executions.slice(0, 3).map((execution) => `${execution.id.slice(0, 8)}: ${execution.status.toLowerCase()}, last recorded position ${execution.data.lastKnownPosition ? "available in the workflow" : "unknown"}`).join("; ")}. This is persisted status, not live GPS.`;
}
