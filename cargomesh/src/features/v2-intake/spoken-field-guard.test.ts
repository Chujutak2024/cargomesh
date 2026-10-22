import assert from "node:assert/strict";
import test from "node:test";
import { checkedSpokenField, lastSpokenQuestionField } from "./spoken-field-guard";
test('word numbers stay grounded in real spoken quantities, not group totals',()=>{
 assert.equal(checkedSpokenField('unitQuantity','12','twelve pallets weighing one thousand two hundred kilograms total',[]),'12');
 assert.equal(checkedSpokenField('unitWeightPerUnitKg','100','each pallet weighs one hundred kilograms',[]),'100');
 assert.equal(checkedSpokenField('unitWeightPerUnitKg','1200','one thousand two hundred kilograms total',[]),null);
});

test("total weight and relative timing cannot become invented unit measurements or exact windows", () => {
  assert.equal(checkedSpokenField("unitWeightPerUnitKg", "1000", "It's 1000 kilograms in total", []), null);
  assert.equal(checkedSpokenField("unitQuantity", "1000", "It's 1000 kilograms", []), null);
  assert.equal(checkedSpokenField("pickupWindowStartsAt", "2027-04-17T08:00", "in six months", []), null);
  assert.equal(checkedSpokenField("unitWeightPerUnitKg", "25", "Each box weighs 25 kg", []), "25");
});

test("a spoken exact date becomes a local datetime and unrelated text cannot become a contact", () => {
  assert.equal(checkedSpokenField("pickupWindowStartsAt", "2026-11-25T08:00", "November 25 2026 at 8:00 AM", []), "2026-11-25T08:00");
  assert.equal(checkedSpokenField("pickupContactName", "hello", "hello", []), null);
  assert.equal(checkedSpokenField("pickupContactName", "Ana Perez", "Ana Perez", [{ speaker: "assistant", text: "What is the pickup contact's name?" }]), "Ana Perez");
});

test("a short answer is interpreted against Nova's latest explicit question", () => {
  const turns = [{ speaker: "assistant" as const, text: "How many boxes are there?" }];
  assert.equal(lastSpokenQuestionField(turns), "unitQuantity");
  assert.equal(checkedSpokenField("unitQuantity", "20", "Twenty", turns), "20");
  assert.equal(checkedSpokenField("unitQuantity", "1000", "1000 kilograms", turns), null);
  assert.equal(lastSpokenQuestionField([{ speaker: "assistant", text: "When does the pickup window start?" }]), "pickupWindowStartsAt");
});
