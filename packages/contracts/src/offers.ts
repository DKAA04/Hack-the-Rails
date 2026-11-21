import { z } from "zod";
import { OfferBookingRequirementsSchema } from "./booking";
import { IdSchema, MoneySchema, UtcSchema } from "./common";
import { ItinerarySchema } from "./journeys";
import { SearchReceiptSchema } from "./search";
export const PriceSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("unknown") }),
    z.object({
      kind: z.enum([
        "live_offer",
        "test_offer",
        "indicative",
        "historical_observation",
      ]),
      total: MoneySchema,
      completeness: z.enum(["complete", "partial"]),
      missingComponents: z.array(z.string()),
      breakdown: z.array(
        z.object({
          label: z.string(),
          money: MoneySchema,
          category: z.enum([
            "fare",
            "tax",
            "baggage",
            "service",
            "payment",
            "transfer",
            "other",
          ]),
        }),
      ),
      observedAt: UtcSchema,
    }),
    z.object({
      kind: z.literal("published_tariff_range"),
      minimum: MoneySchema,
      maximum: MoneySchema,
      observedAt: UtcSchema,
    }),
  ])
  .superRefine((v, ctx) => {
    if (
      v.kind === "published_tariff_range" &&
      (v.minimum.currency !== v.maximum.currency ||
        v.minimum.amount > v.maximum.amount)
    )
      ctx.addIssue({ code: "custom", message: "Invalid tariff range" });
    if (
      "completeness" in v &&
      v.completeness === "complete" &&
      v.missingComponents.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Complete total has missing components",
      });
  });
export type Price = z.infer<typeof PriceSchema>;
export const AftersalesSchema = z.object({
  refund: z.enum(["supported", "unsupported", "unknown"]),
  exchange: z.enum(["supported", "unsupported", "unknown"]),
  cancellation: z.enum(["supported", "unsupported", "unknown"]),
});
export type Aftersales = z.infer<typeof AftersalesSchema>;
export const OfferSchema = z
  .object({
    id: IdSchema,
    provider: IdSchema,
    providerOfferId: IdSchema,
    seller: z.object({
      id: IdSchema,
      name: z.string(),
      merchantOfRecord: z.boolean().nullable(),
    }),
    itinerary: ItinerarySchema,
    price: PriceSchema,
    availability: z.enum(["available", "sold_out", "on_request", "unknown"]),
    environment: z.enum(["live", "test", "unknown"]),
    freshness: z.object({
      fetchedAt: UtcSchema,
      expiresAt: UtcSchema.nullable(),
      state: z.enum(["fresh", "stale", "expired", "unknown"]),
    }),
    conditions: z.object({
      summary: z.string().nullable(),
      termsUrl: z.url().nullable(),
      aftersales: AftersalesSchema,
    }),
    includedServices: z.array(
      z.object({
        kind: z.enum(["cabin_bag", "checked_bag", "seat", "meal", "other"]),
        quantity: z.number().int().nonnegative().nullable(),
        description: z.string(),
      }),
    ),
    reservationState: z.enum(["not_reserved", "held", "unknown"]),
    bookingRequirements: OfferBookingRequirementsSchema.optional(),
  })
  .superRefine((v, c) => {
    if (v.price.kind === "live_offer" && v.environment !== "live")
      c.addIssue({
        code: "custom",
        message: "Live price requires live environment",
      });
    if (v.price.kind === "test_offer" && v.environment !== "test")
      c.addIssue({
        code: "custom",
        message: "Test price requires test environment",
      });
  });
export type Offer = z.infer<typeof OfferSchema>;
export const SearchResultSchema = SearchReceiptSchema.extend({
  offers: z.array(OfferSchema),
  warnings: z.array(z.string()),
  timetableJourneys: z
    .array(
      z.object({
        itinerary: ItinerarySchema,
        source: z.string(),
        attribution: z.string(),
        price: z.object({ kind: z.literal("unknown") }),
        availability: z.literal("unknown"),
        bookingSupported: z.literal(false),
      }),
    )
    .optional(),
  providerStatuses: z
    .array(
      z.object({
        provider: z.string(),
        status: z.enum(["complete", "failed", "unconfigured", "unsupported"]),
        message: z.string().nullable(),
      }),
    )
    .optional(),
  updatedAt: UtcSchema.optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;
export const RevalidationRequestSchema = z.object({
  offerIds: z.array(IdSchema).min(1),
  searchId: IdSchema,
});
export type RevalidationRequest = z.infer<typeof RevalidationRequestSchema>;
export const RevalidationResponseSchema = z.object({
  quoteId: IdSchema,
  status: z.enum(["valid", "changed", "unavailable"]),
  offers: z.array(OfferSchema),
  expiresAt: UtcSchema,
  requiresAcceptance: z.boolean(),
});
export type RevalidationResponse = z.infer<typeof RevalidationResponseSchema>;
