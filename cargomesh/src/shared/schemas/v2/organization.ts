import { z } from "zod";

export const OrganizationValueV2Schema = z.object({
  schemaVersion: z.literal("2.0"),
  code: z.string().trim().min(1).max(100),
  commercialName: z.string().trim().min(1).max(200),
  legalName: z.string().trim().min(1).max(200).nullable(),
  taxIdType: z.string().trim().min(1).max(50).nullable(),
  taxIdValue: z.string().trim().min(1).max(100).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
  corporateEmail: z.string().email().max(254).nullable(),
  corporatePhone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(),
  defaultCurrency: z.literal("USD"), status: z.enum(["ACTIVE", "INACTIVE"]),
}).strict().refine((value) => (value.taxIdType === null) === (value.taxIdValue === null), {
  message: "Tax type and identifier must be supplied together.",
});
export const OrganizationRecordV2Schema = z.object({
  id: z.string().uuid(), version: z.number().int().positive(),
  value: OrganizationValueV2Schema,
  createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
}).strict();
export const OrganizationRevisionV2Schema = z.object({
  expectedVersion: z.number().int().positive(), value: OrganizationValueV2Schema,
}).strict();
export type OrganizationV2 = z.infer<typeof OrganizationRecordV2Schema>;
export type OrganizationValueV2 = z.infer<typeof OrganizationValueV2Schema>;
