import type { LocalDraft } from "./local-draft-model";
type Cargo = Pick<LocalDraft, "quantity" | "unitWeightKg">;

/** Descriptive cargo arithmetic; never a vehicle capacity or availability claim. */
export function cargoChartModel(selected: Cargo, records: readonly Cargo[]) {
  const totalWeightKg = records.reduce((sum, record) => sum + record.quantity * record.unitWeightKg, 0);
  const totalUnits = records.reduce((sum, record) => sum + record.quantity, 0);
  const selectedWeightKg = selected.quantity * selected.unitWeightKg;
  const share = totalWeightKg > 0 ? Math.min(1, selectedWeightKg / totalWeightKg) : 0;
  const averageUnitWeightKg = totalUnits > 0 ? totalWeightKg / totalUnits : 0;
  return { totalWeightKg, selectedWeightKg, share, averageUnitWeightKg,
    comparisonMaxKg: Math.max(selected.unitWeightKg, averageUnitWeightKg, 1) };
}
