import { z } from "zod";
import {
  OfferSchema,
  LegSchema,
  type Offer,
  type SearchIntent,
} from "@wayward/contracts";
import { DuffelPlaceSchema, normalizeDuffelPlace } from "../../places";
import { localToUtc } from "../../routing/time";
import { composeLegs } from "../../routing/compose";
import { decimalMoney } from "../../pricing/money";
const Baggage = z.object({
  type: z.string(),
  quantity: z.number().int().nonnegative(),
});
const Segment = z.object({
  id: z.string(),
  origin: DuffelPlaceSchema,
  destination: DuffelPlaceSchema,
  departing_at: z.string(),
  arriving_at: z.string(),
  operating_carrier: z.object({ name: z.string() }),
  passengers: z
    .array(
      z.object({
        passenger_id: z.string(),
        baggages: z.array(Baggage).optional(),
      }),
    )
    .optional(),
});
const FareRule = z.object({
  allowed: z.boolean(),
  penalty_amount: z.string().nullable().optional(),
  penalty_currency: z.string().nullable().optional(),
});
export const DuffelConditionsSchema = z.object({
  refund_before_departure: FareRule.nullable().optional(),
  refund_after_departure: FareRule.nullable().optional(),
  change_before_departure: FareRule.nullable().optional(),
  change_after_departure: FareRule.nullable().optional(),
});
export function supplierFareRules(value: unknown) {
  return JSON.stringify(DuffelConditionsSchema.parse(value ?? {}));
}
export const DuffelOfferSchema = z.object({
  id: z.string(),
  passengers: z
    .array(
      z.object({
        id: z.string(),
        age: z.number().nullable().optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  payment_requirements: z
    .object({
      requires_instant_payment: z.boolean(),
      price_guarantee_expires_at: z.iso.datetime().nullable().optional(),
      payment_required_by: z.iso.datetime().nullable().optional(),
    })
    .optional(),
  passenger_identity_documents_required: z.boolean().optional(),
  supported_passenger_identity_document_types: z.array(z.string()).optional(),
  live_mode: z.boolean(),
  total_amount: z.string(),
  total_currency: z.string(),
  base_amount: z.string().nullable().optional(),
  base_currency: z.string().nullable().optional(),
  tax_amount: z.string().nullable().optional(),
  tax_currency: z.string().nullable().optional(),
  expires_at: z.iso.datetime(),
  owner: z.object({ id: z.string(), name: z.string() }),
  conditions: DuffelConditionsSchema.optional(),
  slices: z
    .array(z.object({ id: z.string(), segments: z.array(Segment).min(1) }))
    .min(1),
});
export type DuffelOffer = z.infer<typeof DuffelOfferSchema>;
export function normalizeFlight(raw: DuffelOffer, intent: SearchIntent): Offer {
  const legs = raw.slices.flatMap((slice, sliceIndex) =>
    slice.segments.map((segment) => {
      const origin = normalizeDuffelPlace(segment.origin);
      const destination = normalizeDuffelPlace(segment.destination);
      if (!origin || !destination)
        throw new Error("Airport time zone unavailable");
      return LegSchema.parse({
        id: `duffel:${segment.id}`,
        mode: "flight",
        origin,
        destination,
        departureUtc: localToUtc(segment.departing_at, origin.timeZone),
        arrivalUtc: localToUtc(segment.arriving_at, destination.timeZone),
        operator: segment.operating_carrier.name,
        providerIds: [{ provider: "duffel", id: segment.id }],
        timetableStatus: "scheduled",
        seatMapAvailable: null,
        crowding: "unknown",
      });
    }),
  );
  // Compose each directional slice independently; a return stay is not a transfer.
  const itinerary = composeLegs(legs, `duffel:${raw.id}`);
  const sliceBoundaries = new Set(
    raw.slices.slice(1).map((s) => `duffel:${s.segments[0]!.id}`),
  );
  itinerary.transfers = itinerary.transfers.filter(
    (t) => !sliceBoundaries.has(t.toLegId),
  );
  itinerary.missingConnections = itinerary.transfers
    .filter((t) => t.changeLocation)
    .map(
      (t) =>
        `Airport change requires a separately routed and priced connection: ${t.fromLegId} to ${t.toLegId}`,
    );
  itinerary.completeness = itinerary.missingConnections.length
    ? "partial"
    : "complete";
  if (raw.slices.every((slice) => slice.segments.length === 1))
    itinerary.compatibility = "verified";
  const unused = [...(raw.passengers ?? [])];
  const passengerMappings = intent.passengers.flatMap((passenger) => {
    const index = unused.findIndex((p) => p.age === passenger.age);
    if (index < 0) return [];
    const [matched] = unused.splice(index, 1);
    return [{ passengerId: passenger.id, providerPassengerId: matched!.id }];
  });
  const total = decimalMoney(raw.total_amount, raw.total_currency);
  const segments = raw.slices.flatMap((s) => s.segments);
  const included = (kind: string) =>
    Math.min(
      ...segments.map((s) =>
        s.passengers?.length === intent.passengers.length
          ? s.passengers.reduce(
              (n, p) =>
                n +
                (p.baggages
                  ?.filter((b) => b.type === kind)
                  .reduce((q, b) => q + b.quantity, 0) ?? 0),
              0,
            )
          : 0,
      ),
    );
  const cabin = included("carry_on"),
    checked = included("checked");
  const missing: string[] = [];
  if (intent.bags.cabin > cabin)
    missing.push("Requested cabin baggage not confirmed included");
  if (intent.bags.checked > checked)
    missing.push("Requested checked baggage not confirmed included");
  if (intent.bags.bicycles) missing.push("Bicycle carriage not priced");
  if (itinerary.completeness !== "complete")
    missing.push("Airport-change transfer costs");
  const breakdown: {
    label: string;
    money: ReturnType<typeof decimalMoney>;
    category: "fare" | "tax";
  }[] = [];
  if (
    raw.base_amount &&
    raw.tax_amount &&
    raw.base_currency === total.currency &&
    raw.tax_currency === total.currency
  ) {
    const base = decimalMoney(raw.base_amount, total.currency),
      tax = decimalMoney(raw.tax_amount, total.currency);
    if (base.amount + tax.amount === total.amount)
      breakdown.push(
        { label: "Airline base fare", money: base, category: "fare" },
        { label: "Airline taxes", money: tax, category: "tax" },
      );
  }
  if (!breakdown.length)
    breakdown.push({
      label: "Supplier total including taxes",
      money: total,
      category: "fare",
    });
  const now = new Date().toISOString();
  return OfferSchema.parse({
    id: `duffel:${raw.id}`,
    provider: "duffel",
    providerOfferId: raw.id,
    seller: { id: "duffel", name: "Duffel", merchantOfRecord: null },
    itinerary,
    price: {
      kind: raw.live_mode ? "live_offer" : "test_offer",
      total,
      completeness: missing.length ? "partial" : "complete",
      missingComponents: missing,
      breakdown,
      observedAt: now,
    },
    availability:
      Date.parse(raw.expires_at) > Date.now() ? "available" : "unknown",
    environment: raw.live_mode ? "live" : "test",
    freshness: {
      fetchedAt: now,
      expiresAt: raw.expires_at,
      state: Date.parse(raw.expires_at) > Date.now() ? "fresh" : "expired",
    },
    conditions: {
      summary: `Airline: ${raw.owner.name}. No Wayward markup; optional services and airport-change connections are excluded unless explicitly included. Refund/change eligibility is subject to supplier fare conditions and penalties. Supplier fare rules: ${supplierFareRules(raw.conditions)}. Null penalty values are unknown, not zero.`,
      termsUrl: null,
      aftersales: {
        refund: raw.conditions?.refund_before_departure
          ? raw.conditions.refund_before_departure.allowed
            ? "supported"
            : "unsupported"
          : "unknown",
        exchange: raw.conditions?.change_before_departure
          ? raw.conditions.change_before_departure.allowed
            ? "supported"
            : "unsupported"
          : "unknown",
        cancellation: "unknown",
      },
    },
    includedServices: [
      ...(cabin
        ? [
            {
              kind: "cabin_bag",
              quantity: cabin,
              description:
                "Minimum total cabin bag allowance across all passengers/segments",
            },
          ]
        : []),
      ...(checked
        ? [
            {
              kind: "checked_bag",
              quantity: checked,
              description:
                "Minimum total checked bag allowance across all passengers/segments",
            },
          ]
        : []),
    ],
    reservationState: "not_reserved",
    bookingRequirements: {
      holdSupported: raw.payment_requirements
        ? !raw.payment_requirements.requires_instant_payment
        : null,
      priceGuaranteeExpiresAt:
        raw.payment_requirements?.price_guarantee_expires_at ?? null,
      paymentRequiredBy: raw.payment_requirements?.payment_required_by ?? null,
      identityDocumentsRequired:
        raw.passenger_identity_documents_required ?? null,
      supportedIdentityDocuments:
        raw.supported_passenger_identity_document_types ?? [],
      passengerMappings,
    },
  });
}
