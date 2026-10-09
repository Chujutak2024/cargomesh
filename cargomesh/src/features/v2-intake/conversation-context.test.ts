import assert from "node:assert/strict";
import test from "node:test";
import { InterpretationRequestSchema } from "@/features/v2-conversation-prep/interpretation";
import { conversationContext } from "./conversation-context";
import type { V2IntakePrototypeDraft } from "./prototype-model";

test("context summarizes current non-contact draft values without exposing contact details", () => {
  const draft = { originFacilityId: "facility-1", destinationFacilityId: "facility-2", unitQuantity: "2", cargoDescription: "private detail", pickupContactEmail: "person@example.com" } as V2IntakePrototypeDraft;
  const context = conversationContext(draft, "unitWeightPerUnitKg", 7);
  assert.deepEqual(context.knownFields, [
    { field: "originFacilityId", value: "facility-1" },
    { field: "destinationFacilityId", value: "facility-2" },
    { field: "unitQuantity", value: "2" },
  ]);
  assert.equal(context.failedAttempts, 3);
  assert.equal(InterpretationRequestSchema.safeParse({ schemaVersion: "2.0", text: "change it", currentField: "unitWeightPerUnitKg", context }).success, true);
});
