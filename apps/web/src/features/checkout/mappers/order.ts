import type {
  CreateOrderRequest,
  Order,
  RevalidationResponse,
} from "@wayward/contracts";
import {
  providerLabel,
  toOfferJourney,
  toPriceView,
  type JourneyView,
  type PriceView,
  type Tone,
} from "../../comparison/mappers/journey";

// ---------- Traveller form -> CreateOrderRequest ----------

export interface TravellerDraft {
  key: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  age: number | null;
  discounts: { scheme: string; cardReference: string }[];
}
export interface ContactDraft {
  email: string;
  phone: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ageOn(dob: string, onIso: string) {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = onIso.split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age;
}

export function validateTravellers(
  travellers: TravellerDraft[],
  contact: ContactDraft,
  travelDateIso: string,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!contact.email.trim()) e.email = "Enter an email address. Tickets and updates go there.";
  else if (!EMAIL.test(contact.email.trim())) e.email = "That email address doesn't look complete, e.g. name@example.com.";
  if (contact.phone && !/^\+?[0-9 ()-]{6,20}$/.test(contact.phone.trim()))
    e.phone = "Use digits, spaces and an optional + country code.";
  travellers.forEach((t, i) => {
    if (!t.givenName.trim()) e[`t${i}-given`] = "Enter first and middle names as on the ID.";
    if (!t.familyName.trim()) e[`t${i}-family`] = "Enter the surname as on the ID.";
    if (!t.dateOfBirth) e[`t${i}-dob`] = "Enter a date of birth.";
    else {
      const a = ageOn(t.dateOfBirth, travelDateIso);
      if (a === null || a < 0 || a > 120) e[`t${i}-dob`] = "That date of birth isn't valid.";
      else if (t.age !== null && a !== t.age)
        e[`t${i}-dob`] = `This makes them ${a} on the travel date, but the search used ${t.age}. Prices depend on age, so search again or fix the date.`;
    }
  });
  return e;
}

/** Only fields the v1 contract carries are sent; names stay in the form. */
export function toCreateOrderRequest(
  quoteId: string,
  idempotencyKey: string,
  travellers: TravellerDraft[],
  contact: ContactDraft,
  travelDateIso: string,
): CreateOrderRequest {
  return {
    quoteId,
    idempotencyKey,
    email: contact.email.trim(),
    passengers: travellers.map((t) => ({
      id: t.key,
      age: t.age ?? ageOn(t.dateOfBirth, travelDateIso) ?? 0,
      discounts: t.discounts.map((d) => ({
        scheme: d.scheme,
        provider: null,
        cardReference: d.cardReference || null,
      })),
    })),
  };
}

// ---------- Revalidation ----------

export interface QuoteView {
  quoteId: string;
  status: RevalidationResponse["status"];
  statusLabel: string;
  tone: Tone;
  message: string;
  expiresAt: string;
  requiresAcceptance: boolean;
  journeys: JourneyView[];
}

export function toQuoteView(r: RevalidationResponse, searchId: string): QuoteView {
  const meta = {
    valid: { label: "Price confirmed", tone: "ok" as Tone, message: "The seller confirmed this price and availability just now." },
    changed: { label: "Price or times changed", tone: "warn" as Tone, message: "Something changed since you searched. Check the details below before you continue." },
    unavailable: { label: "No longer available", tone: "danger" as Tone, message: "The seller can't offer this any more. Search again for alternatives." },
  }[r.status];
  return {
    quoteId: r.quoteId,
    status: r.status,
    statusLabel: meta.label,
    tone: meta.tone,
    message: meta.message,
    expiresAt: r.expiresAt,
    requiresAcceptance: r.requiresAcceptance,
    journeys: r.offers.map((o) => toOfferJourney(o, searchId)),
  };
}

// ---------- Orders ----------

type OrderState = Order["state"];
type BookingState = Order["bookings"][number]["state"];

const ORDER_STATE: Record<OrderState, { label: string; tone: Tone; explain: string }> = {
  draft: { label: "Draft", tone: "neutral", explain: "Not submitted. Nothing has been booked or charged." },
  pending: { label: "Pending", tone: "warn", explain: "Waiting for sellers to confirm. Don't travel on this yet." },
  confirmed: { label: "Confirmed", tone: "ok", explain: "Every seller confirmed their part." },
  partial: { label: "Partly confirmed", tone: "warn", explain: "Some sellers confirmed and some didn't. Check each booking below." },
  failed: { label: "Failed", tone: "danger", explain: "The booking didn't go through." },
  cancelled: { label: "Cancelled", tone: "neutral", explain: "This order was cancelled." },
};
const BOOKING_STATE: Record<BookingState, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warn" },
  reserved: { label: "Reserved, not ticketed", tone: "info" },
  confirmed: { label: "Confirmed", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  unknown: { label: "Unknown", tone: "neutral" },
};
const PAYMENT: Record<Order["payment"], string> = {
  not_started: "Not started",
  requires_action: "Needs your action",
  processing: "Processing",
  authorized: "Authorised, not yet taken",
  captured: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};
const FULFILMENT: Record<Order["fulfillment"], string> = {
  not_started: "Not started",
  pending: "Waiting for tickets",
  partial: "Some tickets issued",
  fulfilled: "All tickets issued",
  failed: "Ticketing failed",
};
const SETTLEMENT: Record<Order["bookings"][number]["settlement"], string> = {
  not_started: "Not started",
  pending: "Pending",
  settled: "Settled",
  failed: "Failed",
  refunded: "Refunded",
};
const DOC_TYPE: Record<Order["bookings"][number]["tickets"][number]["type"], string> = {
  pdf: "PDF ticket",
  barcode: "Barcode",
  pkpass: "Wallet pass",
  reference: "Booking reference",
};

export interface TicketView {
  id: string;
  typeLabel: string;
  downloadUrl: string | null;
  reference: string | null;
  issuedAt: string;
}
export interface BookingView {
  id: string;
  providerLabel: string;
  providerBookingId: string | null;
  stateLabel: string;
  tone: Tone;
  settlementLabel: string;
  fulfilmentLabel: string;
  tickets: TicketView[];
  aftersales: { refund: string; exchange: string; cancellation: string };
}
export interface OrderView {
  id: string;
  createdAt: string;
  state: OrderState;
  stateLabel: string;
  tone: Tone;
  explain: string;
  total: PriceView;
  paymentLabel: string;
  fulfilmentLabel: string;
  bookings: BookingView[];
  ticketCount: number;
}

export function toOrderView(o: Order): OrderView {
  const s = ORDER_STATE[o.state];
  const bookings = o.bookings.map((b) => ({
    id: b.id,
    providerLabel: providerLabel(b.provider),
    providerBookingId: b.providerBookingId,
    stateLabel: BOOKING_STATE[b.state].label,
    tone: BOOKING_STATE[b.state].tone,
    settlementLabel: SETTLEMENT[b.settlement],
    fulfilmentLabel: FULFILMENT[b.fulfillment],
    tickets: b.tickets.map((t) => ({
      id: t.id,
      typeLabel: DOC_TYPE[t.type],
      downloadUrl: t.downloadUrl,
      reference: t.reference,
      issuedAt: t.issuedAt,
    })),
    aftersales: b.aftersales,
  }));
  return {
    id: o.id,
    createdAt: o.createdAt,
    state: o.state,
    stateLabel: s.label,
    tone: s.tone,
    explain: s.explain,
    total: toPriceView(o.total),
    paymentLabel: PAYMENT[o.payment],
    fulfilmentLabel: FULFILMENT[o.fulfillment],
    bookings,
    ticketCount: bookings.reduce((n, b) => n + b.tickets.length, 0),
  };
}
