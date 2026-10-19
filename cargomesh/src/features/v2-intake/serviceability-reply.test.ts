import assert from "node:assert/strict";
import test from "node:test";
import { serviceabilityReply } from "./serviceability-reply";

test("unknown availability is not described as a rejection", () => {
  const reply = serviceabilityReply({ overallStatus: "unknown", summaryCounts: { totalEvaluated: 1, eligibleCount: 0, unknownCount: 1, ineligibleCount: 0 } }, "es-PE");
  assert.match(reply, /desconocido, no un rechazo/);
  assert.doesNotMatch(reply, /no encontré una opción/);
});

test("ineligible ROAD result guides a new request without claiming another mode is live", () => {
  const reply = serviceabilityReply({ overallStatus: "ineligible", summaryCounts: { totalEvaluated: 2, eligibleCount: 0, unknownCount: 0, ineligibleCount: 2 } }, "es-PE");
  assert.match(reply, /diferente fecha o sede/);
  assert.match(reply, /capacidades futuras/);
});

test("zero candidates follows the backend ineligible result instead of calling it unknown", () => {
  const result = { overallStatus: "ineligible" as const, summaryCounts: { totalEvaluated: 0, eligibleCount: 0, unknownCount: 0, ineligibleCount: 0 } };
  const spanish = serviceabilityReply(result, "es-PE");
  const english = serviceabilityReply(result, "en-US");
  assert.match(spanish, /No encontramos servicios ROAD candidatos/);
  assert.match(spanish, /borrador se guardó correctamente/);
  assert.doesNotMatch(spanish, /desconocido/);
  assert.match(english, /No ROAD candidate services were found/);
  assert.doesNotMatch(english, /unknown/);
});

test("eligible ROAD result remains preliminary", () => {
  const reply = serviceabilityReply({ overallStatus: "eligible", summaryCounts: { totalEvaluated: 2, eligibleCount: 1, unknownCount: 0, ineligibleCount: 1 } }, "en-US");
  assert.match(reply, /preliminary eligible/);
  assert.match(reply, /not a carrier offer or confirmed capacity/);
});
