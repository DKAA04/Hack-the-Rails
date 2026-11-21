import { z } from "zod";
import { IdSchema, ModeSchema, PlaceSchema, UtcSchema } from "./common";
export const PassengerSchema = z.object({
  id: IdSchema,
  age: z.number().int().min(0).max(120),
  discounts: z.array(
    z.object({
      scheme: z.string().min(1),
      provider: IdSchema.nullable(),
      cardReference: z.string().nullable(),
    }),
  ),
});
export type Passenger = z.infer<typeof PassengerSchema>;
export const SearchIntentSchema = z
  .object({
    version: z.literal(1),
    origin: PlaceSchema,
    destination: PlaceSchema,
    departureDate: z.iso.date(),
    returnDate: z.iso.date().nullable(),
    passengers: z.array(PassengerSchema).min(1).max(20),
    bags: z.object({
      cabin: z.number().int().nonnegative(),
      checked: z.number().int().nonnegative(),
      bicycles: z.number().int().nonnegative(),
    }),
    modes: z.array(ModeSchema).min(1),
    preferences: z.object({
      sort: z.enum(["cheapest", "fastest", "comfortable"]),
      maxTransfers: z.number().int().nonnegative().nullable(),
      accessible: z.boolean().nullable(),
      cabin: z.enum(["economy", "premium", "business", "first"]).nullable(),
    }),
    naturalLanguage: z.string().max(4000).nullable(),
  })
  .refine(
    (v) => !v.returnDate || v.returnDate >= v.departureDate,
    "Return precedes departure",
  );
export type SearchIntent = z.infer<typeof SearchIntentSchema>;
export const SearchReceiptSchema = z.object({
  searchId: IdSchema,
  state: z.enum(["pending", "complete", "partial", "failed"]),
  createdAt: UtcSchema,
});
export type SearchReceipt = z.infer<typeof SearchReceiptSchema>;
