import { z } from "zod";
import { CanonicalLocationV2Schema } from "./freight-request";

const Instant = z.string().datetime({ offset: true });
export const FacilityRuleV2Schema = z.object({
  code: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(1000),
  evidenceReference: z.string().trim().min(1).max(500).nullable(),
}).strict();
const Opening = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).strict().refine((item) => item.opensAt < item.closesAt, {
  message: "Split overnight opening into two daily intervals.",
});
export const OperatingHoursV2Schema = z.object({
  timezone: z.string().refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; }
  }, "A valid IANA timezone is required."),
  weekly: z.array(Opening).max(28),
}).strict().superRefine((schedule, ctx) => {
  const sorted = [...schedule.weekly].sort((a, b) =>
    a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].dayOfWeek === sorted[i - 1].dayOfWeek && sorted[i].opensAt < sorted[i - 1].closesAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Opening intervals must not overlap." });
    }
  }
});
export const FacilityInputV2Schema = z.object({
  schemaVersion: z.literal("2.0"),
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  facilityType: z.enum(["SHIPPER_SITE", "WAREHOUSE", "DISTRIBUTION_CENTER", "OTHER"]),
  location: CanonicalLocationV2Schema.omit({ facilityId: true }),
  active: z.boolean(),
  accessRestrictions: z.array(FacilityRuleV2Schema).max(100),
  operatingHours: OperatingHoursV2Schema.nullable(),
}).strict().refine((item) => (item.location.lat === null) === (item.location.lng === null), {
  message: "Latitude and longitude must be supplied together.", path: ["location"],
});
export const FacilityV2Schema = z.object({
  id: z.string().uuid(), organizationId: z.string().uuid(),
  version: z.number().int().positive(),
  value: FacilityInputV2Schema,
  createdAt: Instant, updatedAt: Instant,
}).strict();
export const FacilityResponseV2Schema = z.object({
  schemaVersion: z.literal("2.0"), data: FacilityV2Schema,
  meta: z.object({ idempotentReplay: z.boolean(), environmentProfile: z.literal("v2-clean") }).strict(),
}).strict();
export const FacilityRevisionV2Schema = z.object({
  expectedVersion: z.number().int().positive(), value: FacilityInputV2Schema,
}).strict();
export const PageV2Schema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();
export type FacilityInputV2 = z.infer<typeof FacilityInputV2Schema>;
export type FacilityV2 = z.infer<typeof FacilityV2Schema>;
