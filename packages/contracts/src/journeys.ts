import { z } from "zod";
import {
  IdSchema,
  ModeSchema,
  PlaceSchema,
  ProviderIdSchema,
  UtcSchema,
} from "./common";
export const LegSchema = z
  .object({
    id: IdSchema,
    mode: ModeSchema,
    origin: PlaceSchema,
    destination: PlaceSchema,
    departureUtc: UtcSchema,
    arrivalUtc: UtcSchema,
    operator: z.string().nullable(),
    providerIds: z.array(ProviderIdSchema),
    timetableStatus: z.enum(["scheduled", "estimated", "cancelled", "unknown"]),
    seatMapAvailable: z.boolean().nullable(),
    crowding: z.enum(["low", "medium", "high", "unknown"]),
  })
  .refine(
    (v) => Date.parse(v.arrivalUtc) >= Date.parse(v.departureUtc),
    "Arrival precedes departure",
  );
export type Leg = z.infer<typeof LegSchema>;
export const TransferSchema = z.object({
  fromLegId: IdSchema,
  toLegId: IdSchema,
  durationMinutes: z.number().int().nonnegative(),
  minimumMinutes: z.number().int().nonnegative().nullable(),
  protection: z.enum(["protected", "self_transfer", "unknown"]),
  changeLocation: z.boolean(),
  instructions: z.string().nullable(),
  compatibility: z.enum(["verified", "unverified", "incompatible"]),
});
export type Transfer = z.infer<typeof TransferSchema>;
export const ItinerarySchema = z.object({
  id: IdSchema,
  legs: z.array(LegSchema).min(1),
  transfers: z.array(TransferSchema),
  completeness: z.enum(["complete", "partial"]),
  compatibility: z.enum(["verified", "unverified", "incompatible"]),
  missingConnections: z.array(z.string()),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;
