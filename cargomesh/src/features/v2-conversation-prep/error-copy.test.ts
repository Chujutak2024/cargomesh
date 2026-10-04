import assert from "node:assert/strict";
import test from "node:test";
import { presentConversationError } from "./error-copy";

test("English errors distinguish unknown ROAD state, revoked link and no booking", () => {
  assert.match(presentConversationError("ROAD_EVALUATION_UNAVAILABLE"), /No coverage is confirmed/);
  assert.match(presentConversationError("LINK_REVOKED"), /no longer authorized/);
  assert.match(presentConversationError("BOOKING_UNAVAILABLE"), /No reservation has been made/);
});
