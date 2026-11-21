import {
  UpdateTravellersRequestSchema,
  ReserveOrderRequestSchema,
  type UpdateTravellersRequest,
  type ReserveOrderRequest,
  type Order,
} from "@wayward/contracts";
import type { CustomerContext } from "../auth";
import { hash } from "../auth";
import { authorizedOrder, type StoredOrder } from "../orders";
import { mutateOrder } from "../orders/store";
import { presentOrder } from "../orders/presentation";
import { ServiceError } from "../errors";
import { validateOrderQuote } from "../orders/validation";
import {
  reserveFlight,
  validateTravellers,
  priceHeldOrder,
  findSupplierOrders,
  retrieveSupplierOrder,
  supplierPayments,
  supplierBooking,
  SupplierMutationError,
  assertTestTransaction,
  type DuffelOrder,
} from "../providers/duffel/transactions";
import { localToUtc } from "../routing/time";
import { supplierFareRules } from "../providers/duffel/normalize";
import { decimalMoney } from "../pricing/money";
export function supplierSnapshot(order: DuffelOrder) {
  return hash(
    JSON.stringify({
      amount: decimalMoney(order.total_amount, order.total_currency),
      conditions: supplierFareRules(order.conditions),
      itinerary:
        order.slices?.flatMap((slice) =>
          slice.segments.map((segment) => [
            segment.origin.id,
            segment.destination.id,
            segment.departing_at,
            segment.arriving_at,
          ]),
        ) ?? null,
    }),
  );
}
export function matchesAcceptedSupplier(
  raw: DuffelOrder,
  stored: StoredOrder,
): boolean {
  const accepted = stored.order.total;
  const actual = decimalMoney(raw.total_amount, raw.total_currency);
  if (
    !("total" in accepted) ||
    accepted.total.amount !== actual.amount ||
    accepted.total.currency !== actual.currency ||
    !stored.quote.offers[0]?.conditions.summary?.includes(
      supplierFareRules(raw.conditions),
    ) ||
    !raw.slices
  )
    return false;
  try {
    const legs = raw.slices.flatMap((slice) =>
      slice.segments.map((segment) => [
        segment.origin.id,
        segment.destination.id,
        localToUtc(segment.departing_at, segment.origin.time_zone!),
        localToUtc(segment.arriving_at, segment.destination.time_zone!),
      ]),
    );
    const expected = stored.quote.offers[0].itinerary.legs.map((leg) => [
      leg.origin.providerIds.find((p) => p.provider === "duffel")?.id,
      leg.destination.providerIds.find((p) => p.provider === "duffel")?.id,
      leg.departureUtc,
      leg.arrivalUtc,
    ]);
    return JSON.stringify(legs) === JSON.stringify(expected);
  } catch {
    return false;
  }
}
export async function updateTravellers(
  id: string,
  input: UpdateTravellersRequest,
  context: CustomerContext,
): Promise<Order> {
  const request = UpdateTravellersRequestSchema.parse(input);
  await authorizedOrder(id, context);
  return mutateOrder(id, (stored) => {
    if (
      stored.operation.reserveStartedAt ||
      stored.order.bookings.some((b) => b.providerBookingId)
    )
      throw new ServiceError(
        "CONFLICT",
        "Traveller details cannot be changed after reservation has begun.",
        409,
      );
    const offer = stored.quote.offers[0];
    if (!offer)
      throw new ServiceError("CONFLICT", "Supplier offer is missing.", 409);
    validateTravellers(
      offer,
      stored.intent,
      request.travellers,
      request.contact,
    );
    stored.travellers = request.travellers;
    stored.contact = request.contact;
    delete stored.operation.lastError;
    return presentOrder(stored);
  });
}
export async function reserveOrder(
  id: string,
  input: ReserveOrderRequest,
  context: CustomerContext,
): Promise<Order> {
  const request = ReserveOrderRequestSchema.parse(input);
  await authorizedOrder(id, context);
  const key = hash(request.idempotencyKey);
  const claim = await mutateOrder(id, (stored) => {
    if (
      stored.operation.reserveKeyHash &&
      stored.operation.reserveKeyHash !== key
    )
      throw new ServiceError(
        "CONFLICT",
        "A reservation attempt already owns this order. Reconcile its outcome instead of using another key.",
        409,
      );
    if (
      stored.order.bookings[0]?.providerBookingId ||
      stored.operation.reserveStartedAt
    )
      return { execute: false, stored };
    const offer = stored.quote.offers[0]!;
    if (offer.provider !== "duffel")
      throw new ServiceError(
        "NOT_IMPLEMENTED",
        "The selected supplier has no implemented transaction adapter.",
        501,
      );
    if (!stored.travellers || !stored.contact)
      throw new ServiceError(
        "INVALID_REQUEST",
        "Provide traveller identity and booking contact before reservation.",
        400,
      );
    validateOrderQuote(stored.quote, stored.intent, {
      quoteId: stored.quote.quoteId,
      idempotencyKey: request.idempotencyKey,
      passengers: stored.intent.passengers,
      email: stored.email,
      acceptChanges: true,
    });
    validateTravellers(offer, stored.intent, stored.travellers, stored.contact);
    if (offer.environment !== "test")
      throw new ServiceError(
        "CONFLICT",
        "Live travel purchases are not enabled.",
        409,
      );
    if (offer.bookingRequirements?.holdSupported !== true)
      throw new ServiceError(
        "NOT_IMPLEMENTED",
        "This specific offer does not explicitly support an unpaid hold.",
        501,
      );
    stored.operation.reserveKeyHash = key;
    stored.operation.reserveStartedAt = new Date().toISOString();
    stored.operation.phase = "reserving";
    stored.order.state = "pending";
    return { execute: true, stored };
  });
  if (!claim.execute) return presentOrder(claim.stored);
  try {
    const stored = claim.stored;
    const held = await reserveFlight(
      stored.quote.offers[0]!,
      stored.intent,
      stored.travellers!,
      stored.contact!,
      id,
      async () => {
        await mutateOrder(id, (s) => {
          s.operation.reserveAttemptedAt = new Date().toISOString();
        });
      },
    );
    await applySupplierState(id, held, []);
    const priced = await priceHeldOrder(held.id);
    return await mutateOrder(id, (s) => {
      s.operation.supplierSnapshot = supplierSnapshot(priced);
      s.operation.supplierPaymentRequiredBy =
        priced.payment_status.payment_required_by ?? null;
      s.operation.supplierPriceGuaranteeExpiresAt =
        priced.payment_status.price_guarantee_expires_at ?? null;
      if (!matchesAcceptedSupplier(priced, s)) {
        s.operation.phase = "needs_acceptance";
        s.operation.lastError =
          "Held supplier total differs from the accepted quote. No payment will be requested; search/revalidate again.";
      } else {
        s.operation.phase = "reserved";
        delete s.operation.lastError;
      }
      return presentOrder(s);
    });
  } catch (error) {
    await mutateOrder(id, (s) => {
      s.operation.phase =
        error instanceof SupplierMutationError && error.uncertain
          ? "manual_review"
          : "failed";
      s.operation.lastError =
        error instanceof ServiceError
          ? error.message
          : "Reservation outcome could not be validated. Reconcile before further action.";
      if (!(error instanceof ServiceError)) s.operation.phase = "manual_review";
    });
    throw error;
  }
}
export async function applySupplierState(
  id: string,
  raw: DuffelOrder,
  payments: Awaited<ReturnType<typeof supplierPayments>>,
) {
  assertTestTransaction(raw.live_mode);
  return mutateOrder(id, (s) => {
    const child = s.order.bookings[0];
    if (!child)
      throw new ServiceError(
        "CONFLICT",
        "Supplier child booking is missing.",
        409,
      );
    s.order.bookings[0] = supplierBooking(raw, child, payments);
    s.order.fulfillment = s.order.bookings.every(
      (b) => b.fulfillment === "fulfilled",
    )
      ? "fulfilled"
      : s.order.bookings.some((b) =>
            ["fulfilled", "partial"].includes(b.fulfillment),
          )
        ? "partial"
        : s.order.bookings.some((b) => b.fulfillment === "pending")
          ? "pending"
          : s.order.bookings.some((b) => b.fulfillment === "failed")
            ? "failed"
            : "not_started";
    s.operation.supplierPaymentRequiredBy =
      raw.payment_status.payment_required_by ?? null;
    s.operation.supplierPriceGuaranteeExpiresAt =
      raw.payment_status.price_guarantee_expires_at ?? null;
    if (raw.cancelled_at) {
      s.operation.phase = "failed";
      s.order.state = "failed";
    } else if (s.order.bookings[0].fulfillment === "fulfilled") {
      s.operation.phase =
        s.order.payment === "captured" ? "complete" : "fulfilling";
      if (s.order.payment === "captured") s.order.state = "confirmed";
    } else if (
      !s.operation.settlementAttemptedAt &&
      s.order.bookings[0].state === "reserved" &&
      !["needs_acceptance", "manual_review", "failed", "expired"].includes(
        s.operation.phase ?? "",
      )
    )
      s.operation.phase = s.stripeSessionId ? "awaiting_payment" : "reserved";
    return s;
  });
}
export async function reconcileSupplier(id: string): Promise<StoredOrder> {
  const stored = await mutateOrder(id, (s) => s);
  let supplierId = stored.order.bookings[0]?.providerBookingId;
  if (!supplierId && stored.operation.reserveAttemptedAt) {
    const matches = await findSupplierOrders(
      stored.quote.offers[0]!.providerOfferId,
      id,
    );
    if (matches.length !== 1) {
      return mutateOrder(id, (s) => {
        s.operation.phase = "manual_review";
        s.operation.lastError = matches.length
          ? "Multiple supplier bookings matched; manual reconciliation is required."
          : "No supplier order found yet. Absence is not proof of failure; booking will not be retried.";
        return s;
      });
    }
    supplierId = matches[0]!.id;
  }
  if (!supplierId) return stored;
  const [raw, payments] = await Promise.all([
    retrieveSupplierOrder(supplierId),
    supplierPayments(supplierId),
  ]);
  const updated = await applySupplierState(id, raw, payments);
  if (
    !updated.operation.supplierSnapshot &&
    updated.order.bookings[0]?.state === "reserved"
  )
    return mutateOrder(id, (s) => {
      if (matchesAcceptedSupplier(raw, s)) {
        s.operation.supplierSnapshot = supplierSnapshot(raw);
        s.operation.phase = s.stripeSessionId ? "awaiting_payment" : "reserved";
        delete s.operation.lastError;
      } else {
        s.operation.phase = "needs_acceptance";
        s.operation.lastError =
          "Reconciled supplier hold does not match all accepted price, condition and itinerary data.";
      }
      return s;
    });
  return updated;
}
