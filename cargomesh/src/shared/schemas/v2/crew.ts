import { z } from "zod";
import { TimeWindowV2Schema } from "./freight-request";
const Id = z.string().uuid();
const Text = z.string().trim().min(1).max(500);
const Instant = z.string().datetime({ offset: true });
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid LocalDate.");
const Strings = z.array(Text).max(100).refine(values => new Set(values).size === values.length, "Duplicate values.");
const Evidence = z.object({ reference: Text, verifiedAt: Instant, validUntil: Instant,
  provenanceStatus: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]) }).strict()
  .refine(value => Date.parse(value.validUntil) > Date.parse(value.verifiedAt), "Invalid evidence period.");
const Capacity = z.object({ weightKg: z.number().finite().nonnegative(), volumeM3: z.number().finite().nonnegative() }).strict();
const Base = { schemaVersion: z.literal("2.0"), serviceId: Id };
const AssignmentBase = { ...Base, executionId: Id, window: TimeWindowV2Schema,
  status: z.enum(["PROPOSED", "CONFIRMED", "RELEASED", "CANCELLED"]), evidence: Evidence.nullable() };
export const CrewInputsV2 = {
  drivers: z.object({ ...Base, fullName: Text, portalAccountId: Id.nullable(), licenseClass: Text,
    licenseValidUntil: DateOnly, licenseTimezone: Text.refine(value => {
      try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
    }, "Invalid timezone."), qualifications: Strings, experienceYears: z.number().finite().nonnegative().nullable(),
    dutyStatus: z.enum(["AVAILABLE", "ON_DUTY", "OFF_DUTY", "SUSPENDED", "UNKNOWN"]),
    evidence: Evidence.nullable(), availableWindows: z.array(TimeWindowV2Schema).max(100),
    dutyWindow: TimeWindowV2Schema.nullable(), maximumDutySeconds: z.number().int().positive().nullable(),
    usedDutySeconds: z.number().int().nonnegative() }).strict()
    .refine(value => (value.dutyWindow === null) === (value.maximumDutySeconds === null), "Duty policy requires window and limit together.")
    .refine(value => value.maximumDutySeconds === null || value.usedDutySeconds <= value.maximumDutySeconds, "Duty already exceeds limit."),
  "vehicle-combinations": z.object({ ...Base, kind: Text, configuration: Text,
    assetIds: z.array(Id).min(1).max(20).refine(values => new Set(values).size === values.length, "Duplicate member."),
    coupledWindow: TimeWindowV2Schema.nullable(), evidence: z.array(Evidence).max(100),
    combinedTareKg: z.number().finite().nonnegative().nullable(), grossWeightLimitKg: z.number().finite().positive().nullable(),
    status: z.enum(["PROPOSED", "COUPLED", "RELEASED", "CANCELLED"]),
    compatibilityEvidence: Evidence.nullable() }).strict()
    .refine(value => value.status !== "COUPLED" || value.coupledWindow !== null, "Coupling requires window.")
    .refine(value => value.combinedTareKg === null || value.grossWeightLimitKg === null
      || value.combinedTareKg < value.grossWeightLimitKg, "Tare must be below gross limit."),
  "driver-assignments": z.object({ ...AssignmentBase, driverId: Id, role: z.enum(["PRIMARY", "RELIEF"]),
    acceptedLicenseClasses: Strings, requiredQualifications: Strings, policyEvidence: Evidence.nullable() }).strict(),
  "vehicle-assignments": z.object({ ...AssignmentBase, assetId: Id, combinationId: Id.nullable(),
    reservationId: Id.nullable(), capacityCommitted: Capacity }).strict()
    .refine(value => value.status !== "CONFIRMED" || value.reservationId !== null, "Confirmation requires reservation."),
} as const;
