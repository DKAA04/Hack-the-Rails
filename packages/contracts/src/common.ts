import { z } from "zod";
export const ContractVersionSchema = z.literal(1);
export const IdSchema = z.string().min(1).max(512);
export const UtcSchema = z.iso.datetime();
export const TimeZoneSchema = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Expected an IANA time zone");
export const MoneySchema = z.object({
  amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type Money = z.infer<typeof MoneySchema>;
export const ModeSchema = z.enum([
  "flight",
  "rail",
  "coach",
  "ferry",
  "local_transit",
  "walking",
  "transfer",
]);
export type Mode = z.infer<typeof ModeSchema>;
export const ProviderIdSchema = z.object({ provider: IdSchema, id: IdSchema });
export const PlaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  kind: z.enum(["city", "airport", "station", "port", "local_stop"]),
  countryCode: z.string().length(2).nullable(),
  timeZone: TimeZoneSchema,
  providerIds: z.array(ProviderIdSchema),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .nullable(),
});
export type Place = z.infer<typeof PlaceSchema>;
export const CapabilityStatusSchema = z.enum([
  "available",
  "unconfigured",
  "unverified",
  "unsupported",
  "not_implemented",
  "unavailable",
]);
export const OperationSchema = z.enum([
  "search",
  "reprice",
  "reserve",
  "book",
  "fulfillment",
  "aftersales",
]);
export type Operation = z.infer<typeof OperationSchema>;
export const ProviderCapabilitySchema = z.object({
  id: IdSchema,
  modes: z.array(ModeSchema),
  credentialsPresent: z.boolean().nullable(),
  connectivity: z.enum(["not_checked", "verified", "failed"]),
  operations: z.record(OperationSchema, CapabilityStatusSchema),
  note: z.string(),
});
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;
export const CapabilitiesSchema = z.object({
  version: ContractVersionSchema,
  environment: z.enum(["development", "live"]),
  providers: z.array(ProviderCapabilitySchema),
  payments: CapabilityStatusSchema,
  paymentProvider: z
    .object({
      id: z.literal("stripe"),
      credentialsPresent: z.boolean(),
      connectivity: z.enum(["not_checked", "verified", "failed"]),
      environment: z.enum(["test", "live", "unknown"]),
    })
    .optional(),
  persistence: CapabilityStatusSchema,
  naturalLanguage: CapabilityStatusSchema,
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export const HealthSchema = z.object({
  version: ContractVersionSchema,
  status: z.literal("ok"),
  timestamp: UtcSchema,
  environment: z.enum(["development", "live"]),
  configurationValid: z.boolean(),
  database: z.object({
    configured: z.boolean(),
    connectivity: z.literal("not_checked"),
  }),
});
export type Health = z.infer<typeof HealthSchema>;
