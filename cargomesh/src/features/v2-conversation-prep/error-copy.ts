import { ConversationErrorV2Schema } from "./contract";

type Code = (typeof ConversationErrorV2Schema)["shape"]["code"]["_type"];

const english: Record<Code, string> = {
  VALIDATION_ERROR: "Some details need correction. Review the highlighted fields.",
  AUTH_REQUIRED: "Sign in to continue with your freight request.",
  SCOPE_DENIED: "This account is not authorized for this action.",
  LINK_REVOKED: "Your connected account is no longer authorized. Reconnect it before continuing.",
  TENANT_DENIED: "This request is not available in your organization.",
  STALE_DRAFT: "The draft changed. Reload it and review your details before trying again.",
  IDEMPOTENCY_CONFLICT: "This retry key was used for different details. Review the request before retrying.",
  PLACE_AMBIGUOUS: "I found multiple places. Choose one explicitly.",
  PLACE_NOT_FOUND: "I could not find that place. Try a more specific address or pin.",
  PLACE_IMPRECISE: "The location is approximate. Provide a more precise address or pin.",
  PROVIDER_UNAVAILABLE: "The location provider is unavailable. You can keep editing the draft and try again later.",
  ROAD_EVALUATION_UNAVAILABLE: "ROAD eligibility could not be checked right now. No coverage is confirmed.",
  PRICE_UNAVAILABLE: "There is no current V2 carrier offer with a confirmed price.",
  BOOKING_UNAVAILABLE: "V2 booking is not available. No reservation has been made.",
};

export function presentConversationError(code: Code): string {
  return english[code];
}
