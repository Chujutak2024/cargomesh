import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_PROTOTYPE_DRAFT } from "./prototype-model";
import { canApproveDraftReview, proposeDraftReview } from "./draft-review";

test("approval applies only to the exact reviewed draft within five minutes", () => {
  const review = proposeDraftReview(EMPTY_PROTOTYPE_DRAFT, 1000);
  assert.equal(canApproveDraftReview(review, EMPTY_PROTOTYPE_DRAFT, 1001), true);
  assert.equal(canApproveDraftReview(review, { ...EMPTY_PROTOTYPE_DRAFT, cargoDescription: "changed" }, 1001), false);
  assert.equal(canApproveDraftReview(review, EMPTY_PROTOTYPE_DRAFT, 301000), false);
  assert.equal(canApproveDraftReview(null, EMPTY_PROTOTYPE_DRAFT, 1001), false);
});
