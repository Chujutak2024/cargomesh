import assert from "node:assert/strict";
import test from "node:test";
import { buildSpokenRequestReview, spokenReviewCommand, spokenRouteConflictsWithDraft, spokenTotalWeightKg } from "./spoken-request-review";

test("spoken total weight is retained as a check, not invented per-unit measurements", () => {
  assert.equal(spokenTotalWeightKg("thousand kilograms"), 1000);
  assert.equal(spokenTotalWeightKg("two thousand kilograms"), 2000);
  assert.equal(spokenTotalWeightKg("2,000 kg"), 2000);
  assert.equal(spokenTotalWeightKg("in six months"), null);
});

test("only explicit spoken review commands authorize applying details or creating a draft", () => {
  assert.equal(spokenReviewCommand("CargoMesh, apply recognized details."), "apply");
  assert.equal(spokenReviewCommand("CargoMesh, confirm and create my draft."), "confirm");
  assert.equal(spokenReviewCommand("CargoMesh confirm and save my draft revision"), "confirm");
  assert.equal(spokenReviewCommand("yes"), null);
  assert.equal(spokenReviewCommand("confirm"), null);
  assert.equal(spokenReviewCommand("The assistant said confirm and create my draft"), null);
});
import { applyChatFieldsToDraft, EMPTY_PROTOTYPE_DRAFT, validatePrototypeReview } from "./prototype-model";
import type { IntakeOptionsData } from "./contracts";

const options = {
  facilities: [
    { facilityId: "lima", code: "LIM", label: "Lima depot", city: "Lima" },
    { facilityId: "piura", code: "PIU", label: "Piura depot", city: "Piura" },
    { facilityId: "arequipa", code: "AQP", label: "Arequipa depot", city: "Arequipa" },
  ],
  packagingOptions: [{ code: "BOX", labelEn: "Box" }],
  requirementOptions: [{ code: "FRAGILE", labelEn: "Fragile cargo" }],
  cargoCategories: [], equipmentOptions: [],
} as unknown as IntakeOptionsData;

test("voice review shows corrected international route, weight and handling without inventing price or destination ID", () => {
  const review = buildSpokenRequestReview([
    { speaker: "user", contentId: "nova:one:1", text: "from Lima to Piura no sorry I need to go from Lima to Santiago Chile", provisional: false },
    { speaker: "user", contentId: "nova:one:2", text: "I'm shipping robots in boxes, around two thousand kilograms", provisional: false },
    { speaker: "user", contentId: "nova:one:3", text: "in a couple of months, fragile handling", provisional: false },
  ], options, EMPTY_PROTOTYPE_DRAFT);
  assert.equal(review.pickup, "Lima");
  assert.equal(review.destination, "Santiago Chile");
  assert.equal(review.weight, "two thousand kilograms");
  assert.equal(review.timing, "in a couple of months");
  assert.deepEqual(review.handling, ["Fragile handling"]);
  assert.ok(review.fields.some((item) => item.field === "originFacilityId" && item.value === "lima"));
  assert.ok(review.fields.some((item) => item.field === "requirements" && item.value === "FRAGILE"));
  assert.ok(!review.fields.some((item) => item.field === "destinationFacilityId"));
  const draft = applyChatFieldsToDraft(EMPTY_PROTOTYPE_DRAFT, review.fields);
  assert.equal(draft.originFacilityId, "lima");
  assert.equal(draft.destinationFacilityId, "");
  assert.deepEqual(draft.requirements, ["FRAGILE"]);
  assert.equal(validatePrototypeReview(draft).valid, false);
  assert.equal(spokenRouteConflictsWithDraft(review, options, { ...draft, destinationFacilityId: "piura" }), true);
});

test("natural Lima to Germany speech appears in the review without inventing a German facility", () => {
  const review = buildSpokenRequestReview([
    { speaker: "user", contentId: "nova:two:1", text: "for the last time i need help", provisional: false },
    { speaker: "user", contentId: "nova:two:2", text: "well i got a ton of boxes here in lima i would like to go to germany", provisional: false },
    { speaker: "user", contentId: "nova:two:3", text: "well in the boxes i have robots and i need at least two thousand kilograms", provisional: false },
    { speaker: "user", contentId: "nova:two:4", text: "well it have to be there in at least eight months", provisional: false },
    { speaker: "user", contentId: "nova:two:5", text: "it have to be fragile and also in a dry environment", provisional: false },
  ], options, EMPTY_PROTOTYPE_DRAFT);
  assert.equal(review.pickup.toLowerCase(), "lima");
  assert.equal(review.destination.toLowerCase(), "germany");
  assert.equal(review.cargo.toLowerCase(), "robots");
  assert.equal(review.timing.toLowerCase(), "in at least eight months");
  assert.deepEqual(review.handling, ["Fragile handling", "Dry environment"]);
  assert.ok(review.fields.some((item) => item.field === "originFacilityId" && item.value === "lima"));
  assert.ok(!review.fields.some((item) => item.field === "destinationFacilityId"));
});

test("a spoken Lima to Arequipa route stops before the next sentence and applies the authorized destination", () => {
  const review = buildSpokenRequestReview([
    { speaker: "user", contentId: "nova:three:1", text: "well i like to go from lima to arequipa i like to send boxes", provisional: false },
    { speaker: "user", contentId: "nova:three:2", text: "yes it's a thousand kilograms", provisional: false },
  ], options, EMPTY_PROTOTYPE_DRAFT);
  assert.equal(review.pickup, "lima");
  assert.equal(review.destination, "arequipa");
  assert.equal(review.cargo, "boxes");
  assert.ok(review.fields.some((item) => item.field === "destinationFacilityId" && item.value === "arequipa"));
  const draft = applyChatFieldsToDraft(EMPTY_PROTOTYPE_DRAFT, review.fields);
  assert.equal(draft.originFacilityId, "lima");
  assert.equal(draft.destinationFacilityId, "arequipa");
  assert.equal(draft.cargoDescription, "boxes");
  assert.equal(draft.packaging, "BOX");
});

test("a later Spanish route correction supersedes the earlier English route",()=>{
 const review=buildSpokenRequestReview([{speaker:'user',contentId:'nova:fix:1',text:'from Lima to Piura'},{speaker:'user',contentId:'nova:fix:2',text:'corrige de Lima a Arequipa'}],options,EMPTY_PROTOTYPE_DRAFT);
 assert.equal(review.pickup,'Lima');assert.equal(review.destination,'Arequipa');
});
test("per-unit weight never becomes a contradictory shipment total in the voice review",()=>{
 const review=buildSpokenRequestReview([{speaker:'user',contentId:'nova:weight:1',text:'10 pallets de 100 kg cada uno'}],options,EMPTY_PROTOTYPE_DRAFT);
 assert.equal(review.weight,'');
});
