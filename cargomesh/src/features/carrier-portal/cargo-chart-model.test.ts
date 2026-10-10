import assert from "node:assert/strict";
import test from "node:test";
import { cargoChartModel } from "./cargo-chart-model";
test("cargo share and average use unit counts rather than an unweighted mean", () => {
  const selected = { quantity: 20, unitWeightKg: 1000 };
  const result = cargoChartModel(selected, [selected, { quantity: 10, unitWeightKg: 800 }]);
  assert.equal(result.totalWeightKg, 28000);
  assert.equal(result.selectedWeightKg, 20000);
  assert.equal(result.share, 20000 / 28000);
  assert.equal(result.averageUnitWeightKg, 28000 / 30);
  assert.equal(result.comparisonMaxKg, 1000);
});
test("empty and zero cargo render bounded zero values without division by zero", () => {
  for (const records of [[], [{ quantity: 0, unitWeightKg: 0 }]]) {
    const result = cargoChartModel({ quantity: 0, unitWeightKg: 0 }, records);
    assert.deepEqual(result, { totalWeightKg: 0, selectedWeightKg: 0, share: 0,
      averageUnitWeightKg: 0, comparisonMaxKg: 1 });
  }
});
