import { z } from "zod";
import {
  SupplierDocumentSchema,
  type BookingContact,
  type BookingPassenger,
  type SearchIntent,
  type Offer,
  type SupplierBooking,
} from "@wayward/contracts";
import { configuration } from "../../config";
import { ServiceError } from "../../errors";
import { duffelJson } from "./client";
import { DuffelOfferSchema, normalizeFlight } from "./normalize";
import { decimalMoney } from "../../pricing/money";
export const DuffelOrderSchema = z.object({
  id: z.string(),
  live_mode: z.boolean(),
  type: z.string().nullable().optional(),
  created_at: z.iso.datetime(),
  total_amount: z.string(),
  total_currency: z.string(),
  booking_reference: z.string().optional(),
  cancelled_at: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  payment_status: z.object({
    awaiting_payment: z.boolean(),
    payment_required_by: z.iso.datetime().nullable().optional(),
    price_guarantee_expires_at: z.iso.datetime().nullable().optional(),
  }),
  documents: z
    .array(
      z.object({
        type: z.string(),
        unique_identifier: z.string(),
        passenger_ids: z.array(z.string()).optional(),
        issued_at: z.iso.datetime().optional(),
        url: z.url().optional(),
      }),
    )
    .default([]),
  passengers: z.array(z.object({ id: z.string() })).optional(),
  conditions: z.unknown().optional(),
});
export type DuffelOrder = z.infer<typeof DuffelOrderSchema>;
export const DuffelPaymentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  status: z.enum(["succeeded", "pending", "failed", "cancelled"]),
  live_mode: z.boolean(),
  amount: z.string(),
  currency: z.string().nullable(),
});
export type DuffelPayment = z.infer<typeof DuffelPaymentSchema>;
export class SupplierMutationError extends ServiceError {
  constructor(
    message: string,
    public uncertain: boolean,
    status = 503,
  ) {
    super("PROVIDER_UNAVAILABLE", message, status, false);
  }
}
export function assertTestTransaction(liveMode: boolean) {
  if (
    !configuration().valid ||
    configuration().environment !== "development" ||
    liveMode
  )
    throw new ServiceError(
      "CONFLICT",
      "Only explicit development/test supplier transactions are enabled. Live purchase is not authorized.",
      409,
    );
  if (!process.env.DUFFEL_ACCESS_TOKEN?.startsWith("duffel_test_"))
    throw new ServiceError(
      "CONFLICT",
      "Supplier mutation requires a Duffel test token and a verified test response.",
      409,
    );
}
async function mutation(path: string, body: unknown): Promise<unknown> {
  assertTestTransaction(false);
  try {
    const response = await fetch(`https://api.duffel.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: body }),
      redirect: "error",
      signal: AbortSignal.timeout(130000),
      cache: "no-store",
    });
    if (response.status === 202)
      throw new SupplierMutationError(
        "Supplier accepted an asynchronous request. Reconcile; do not submit it again.",
        true,
      );
    if (!response.ok) {
      let codes: string[] = [];
      try {
        const error = await response.json();
        codes = z
          .object({
            errors: z.array(
              z.object({ code: z.string().regex(/^[a-zA-Z0-9_.-]+$/) }),
            ),
          })
          .parse(error)
          .errors.map((e) => e.code);
      } catch {}
      throw new SupplierMutationError(
        `Supplier rejected the request (HTTP ${response.status}${codes.length ? `; ${codes.join(", ")}` : ""}).${response.status >= 500 ? " Outcome is uncertain; reconcile before any further action." : ""}`,
        response.status >= 500,
      );
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof SupplierMutationError || error instanceof ServiceError)
      throw error;
    throw new SupplierMutationError(
      "Supplier response was not received or could not be read. Outcome is uncertain; do not retry ticket creation.",
      true,
    );
  }
}
export async function currentOffer(id: string) {
  const raw = z
    .object({ data: DuffelOfferSchema })
    .parse(
      await duffelJson(
        `/air/offers/${encodeURIComponent(id)}?return_available_services=true`,
      ),
    );
  return raw.data;
}
export function validateTravellers(
  offer: Offer,
  intent: SearchIntent,
  travellers: BookingPassenger[],
  contact: BookingContact,
) {
  if (
    travellers.length !== intent.passengers.length ||
    new Set(travellers.map((t) => t.passengerId)).size !== travellers.length
  )
    throw new ServiceError(
      "INVALID_REQUEST",
      "Provide one uniquely identified traveller for every search passenger.",
      400,
    );
  const mappings = offer.bookingRequirements?.passengerMappings ?? [];
  for (const traveller of travellers) {
    const passenger = intent.passengers.find(
      (p) => p.id === traveller.passengerId,
    );
    if (!passenger)
      throw new ServiceError(
        "INVALID_REQUEST",
        "Traveller is not in the original search.",
        400,
      );
    const born = traveller.bornOn,
      depart = intent.departureDate;
    const age =
      Number(depart.slice(0, 4)) -
      Number(born.slice(0, 4)) -
      (depart.slice(5) < born.slice(5) ? 1 : 0);
    if (age !== passenger.age)
      throw new ServiceError(
        "CONFLICT",
        "Date of birth does not match age on departure. Search again with the correct ages.",
        409,
      );
    if (age < 2)
      throw new ServiceError(
        "NOT_IMPLEMENTED",
        "Infant-to-adult supplier associations are not implemented; do not reserve this order.",
        501,
      );
    if (!mappings.some((p) => p.passengerId === passenger.id))
      throw new ServiceError(
        "CONFLICT",
        "Supplier passenger mapping is unavailable. Search again.",
        409,
      );
    const docs = traveller.identityDocuments;
    if (
      offer.bookingRequirements?.identityDocumentsRequired &&
      docs.length === 0
    )
      throw new ServiceError(
        "INVALID_REQUEST",
        "Supplier requires a supported identity document for each traveller.",
        400,
      );
    for (const doc of docs) {
      if (
        !offer.bookingRequirements?.supportedIdentityDocuments.includes(
          doc.type,
        )
      )
        throw new ServiceError(
          "INVALID_REQUEST",
          "Supplier does not support the supplied identity document type.",
          400,
        );
      if (doc.expiresOn < (intent.returnDate ?? intent.departureDate))
        throw new ServiceError(
          "INVALID_REQUEST",
          "Identity document expires before the journey ends.",
          400,
        );
    }
  }
  if (!contact.phoneNumber || !contact.email)
    throw new ServiceError(
      "INVALID_REQUEST",
      "Booking contact email and E.164 phone number are required.",
      400,
    );
}
export async function reserveFlight(
  offer: Offer,
  intent: SearchIntent,
  travellers: BookingPassenger[],
  contact: BookingContact,
  reference: string,
  beforeMutation?: () => Promise<void>,
): Promise<DuffelOrder> {
  const raw = await currentOffer(offer.providerOfferId);
  assertTestTransaction(raw.live_mode);
  const fresh = normalizeFlight(raw, intent);
  validateTravellers(fresh, intent, travellers, contact);
  if (raw.payment_requirements?.requires_instant_payment !== false)
    throw new ServiceError(
      "NOT_IMPLEMENTED",
      "This supplier offer does not explicitly support an unpaid hold. Instant purchases are not enabled.",
      501,
    );
  if (
    !("total" in fresh.price) ||
    !("total" in offer.price) ||
    fresh.price.total.amount !== offer.price.total.amount ||
    fresh.price.total.currency !== offer.price.total.currency ||
    JSON.stringify(fresh.conditions) !== JSON.stringify(offer.conditions) ||
    JSON.stringify(fresh.includedServices) !==
      JSON.stringify(offer.includedServices) ||
    JSON.stringify(
      fresh.itinerary.legs.map((l) => [
        l.origin.id,
        l.destination.id,
        l.departureUtc,
        l.arrivalUtc,
      ]),
    ) !==
      JSON.stringify(
        offer.itinerary.legs.map((l) => [
          l.origin.id,
          l.destination.id,
          l.departureUtc,
          l.arrivalUtc,
        ]),
      )
  )
    throw new ServiceError(
      "CONFLICT",
      "Supplier price, conditions or itinerary changed. Revalidate and obtain customer acceptance before reserving.",
      409,
    );
  const passengers = travellers.map((t) => ({
    id: fresh.bookingRequirements!.passengerMappings.find(
      (p) => p.passengerId === t.passengerId,
    )!.providerPassengerId,
    given_name: t.givenName,
    family_name: t.familyName,
    born_on: t.bornOn,
    title: t.title,
    gender: t.gender,
    email: contact.email,
    phone_number: contact.phoneNumber,
    ...(t.identityDocuments.length
      ? {
          identity_documents: t.identityDocuments.map((d) => ({
            type: d.type,
            unique_identifier: d.uniqueIdentifier,
            issuing_country_code: d.issuingCountryCode,
            expires_on: d.expiresOn,
          })),
        }
      : {}),
  }));
  await beforeMutation?.();
  const result = await mutation("/air/orders", {
    type: "hold",
    selected_offers: [offer.providerOfferId],
    passengers,
    metadata: { wayward_order_id: reference },
  });
  try {
    const order = z.object({ data: DuffelOrderSchema }).parse(result).data;
    assertTestTransaction(order.live_mode);
    return order;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new SupplierMutationError(
      "Supplier hold response could not be normalized. Reconcile using the offer/reference; do not create another booking.",
      true,
    );
  }
}
export async function retrieveSupplierOrder(id: string): Promise<DuffelOrder> {
  return z
    .object({ data: DuffelOrderSchema })
    .parse(await duffelJson(`/air/orders/${encodeURIComponent(id)}`)).data;
}
export async function findSupplierOrders(
  offerId: string,
  reference: string,
): Promise<DuffelOrder[]> {
  const data = z
    .object({ data: z.array(DuffelOrderSchema) })
    .parse(
      await duffelJson(
        `/air/orders?offer_id=${encodeURIComponent(offerId)}&limit=100`,
      ),
    );
  return data.data.filter((o) => o.metadata?.wayward_order_id === reference);
}
export async function priceHeldOrder(id: string): Promise<DuffelOrder> {
  // Balance settlement uses the current held-order total. The documented actions/price
  // endpoint accepts card/airline-credit only; do not send an invented balance format.
  const order = await retrieveSupplierOrder(id);
  assertTestTransaction(order.live_mode);
  return order;
}
export async function settleHeldOrder(
  order: DuffelOrder,
): Promise<DuffelPayment> {
  assertTestTransaction(order.live_mode);
  if (!order.payment_status.awaiting_payment)
    throw new ServiceError(
      "CONFLICT",
      "Supplier order is not awaiting payment. Reconcile its payment history.",
      409,
    );
  const deadline = order.payment_status.payment_required_by;
  if (!deadline || Date.parse(deadline) <= Date.now())
    throw new ServiceError(
      "QUOTE_EXPIRED",
      "Supplier payment deadline expired or is unknown.",
      409,
    );
  const result = await mutation("/air/payments", {
    order_id: order.id,
    payment: {
      type: "balance",
      amount: order.total_amount,
      currency: order.total_currency,
    },
  });
  try {
    const payment = z.object({ data: DuffelPaymentSchema }).parse(result).data;
    assertTestTransaction(payment.live_mode);
    if (payment.order_id !== order.id) throw new Error();
    return payment;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new SupplierMutationError(
      "Supplier payment outcome is uncertain. Read payment history; do not resubmit payment.",
      true,
    );
  }
}
export async function supplierPayments(id: string): Promise<DuffelPayment[]> {
  return z
    .object({ data: z.array(DuffelPaymentSchema) })
    .parse(
      await duffelJson(
        `/air/payments?order_id=${encodeURIComponent(id)}&limit=100`,
      ),
    ).data;
}
export function supplierBooking(
  order: DuffelOrder,
  existing: SupplierBooking,
  payments: DuffelPayment[],
): SupplierBooking {
  const observedAt = new Date().toISOString();
  const docs = order.documents.map((d, index) =>
    SupplierDocumentSchema.parse({
      id: `duffel:${order.id}:document:${index}`,
      documentType: d.type,
      reference: d.unique_identifier,
      downloadUrl: d.url ?? null,
      issuedAt: d.issued_at ?? null,
      observedAt,
      passengerProviderIds: d.passenger_ids ?? [],
    }),
  );
  const paid = payments.some(
    (p) =>
      p.status === "succeeded" &&
      p.live_mode === order.live_mode &&
      p.order_id === order.id &&
      p.currency === order.total_currency &&
      decimalMoney(p.amount, p.currency).amount ===
        decimalMoney(order.total_amount, order.total_currency).amount,
  );
  const ticketed = docs.some((d) => d.documentType === "electronic_ticket");
  const allTicketed =
    ticketed &&
    !!order.passengers?.length &&
    order.passengers.every((p) =>
      docs.some(
        (d) =>
          d.documentType === "electronic_ticket" &&
          d.passengerProviderIds.includes(p.id),
      ),
    );
  const awaiting = order.payment_status.awaiting_payment && !order.cancelled_at;
  return {
    ...existing,
    providerBookingId: order.id,
    state: order.cancelled_at
      ? "cancelled"
      : paid && allTicketed
        ? "confirmed"
        : awaiting
          ? "reserved"
          : "unknown",
    settlement: paid
      ? "settled"
      : payments.some((p) => p.status === "pending")
        ? "pending"
        : payments.some((p) => p.status === "failed")
          ? "failed"
          : "not_started",
    fulfillment: allTicketed
      ? "fulfilled"
      : ticketed
        ? "partial"
        : paid
          ? "pending"
          : "not_started",
    tickets: docs
      .filter(
        (d) => d.issuedAt !== null && d.documentType === "electronic_ticket",
      )
      .map((d) => ({
        id: d.id,
        supplierBookingId: existing.id,
        type: "reference" as const,
        downloadUrl: d.downloadUrl,
        reference: d.reference,
        issuedAt: d.issuedAt!,
      })),
    supplierDocuments: docs,
  };
}
