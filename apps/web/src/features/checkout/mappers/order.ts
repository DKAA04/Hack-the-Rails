import type {
  BookingContact,
  BookingPassenger,
  CreateOrderRequest,
  Order,
  OrderWorkflow,
  RevalidationResponse,
  UpdateTravellersRequest,
} from "@wayward/contracts";
import {
  providerLabel,
  toOfferJourney,
  toPriceView,
  type JourneyView,
  type PriceView,
  type Tone,
} from "../../comparison/mappers/journey";

// ---------- Traveller form (in memory only) -> BookingPassenger ----------

export type Title = "" | "mr" | "ms" | "mrs" | "miss" | "dr";
export type Gender = "" | "m" | "f";
export type DocumentType = "passport" | "identity_card";

export interface DocumentDraft {
  type: DocumentType | "";
  number: string;
  issuingCountry: string;
  expiresOn: string;
}

/** Never persisted: lives in component state only. */
export interface TravellerDraft {
  /** The search passenger ID this traveller fills (SearchIntent.passengers[].id). */
  passengerId: string;
  /** Age used for the search, if known. */
  age: number | null;
  title: Title;
  gender: Gender;
  givenName: string;
  familyName: string;
  bornOn: string;
  document: DocumentDraft;
  discounts: { scheme: string; cardReference: string }[];
}
export interface ContactDraft {
  email: string;
  phone: string;
}

export const TITLES: { value: Exclude<Title, "">; label: string }[] = [
  { value: "mr", label: "Mr" },
  { value: "ms", label: "Ms" },
  { value: "mrs", label: "Mrs" },
  { value: "miss", label: "Miss" },
  { value: "dr", label: "Dr" },
];
export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  passport: "Passport",
  identity_card: "National ID card",
};

/** What the offers in this checkout require from travellers. */
export interface DocumentPolicy {
  required: boolean;
  /** Accepted types. Empty when required but the supplier didn't say which. */
  accepted: DocumentType[];
}
export function documentPolicy(journeys: JourneyView[]): DocumentPolicy {
  const required = journeys.some((j) => j.bookingRequirements?.identityDocumentsRequired === true);
  if (!required) return { required: false, accepted: [] };
  const sets = journeys
    .map((j) => j.bookingRequirements?.supportedIdentityDocuments ?? [])
    .filter((s) => s.length);
  const accepted = sets.length
    ? (["passport", "identity_card"] as DocumentType[]).filter((t) => sets.every((s) => s.includes(t)))
    : (["passport", "identity_card"] as DocumentType[]);
  return { required, accepted };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+[1-9]\d{6,14}$/;

/** Strips spaces, dashes, dots and brackets; keeps a leading + and digits. */
export function normalisePhone(raw: string) {
  const t = raw.trim();
  const plus = t.startsWith("+") || t.startsWith("00");
  const digits = t.replace(/^00/, "").replace(/[^\d]/g, "");
  return plus ? `+${digits}` : digits;
}

export function ageOn(dob: string, onIso: string) {
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
  policy: DocumentPolicy,
): Record<string, string> {
  const e: Record<string, string> = {};
  travellers.forEach((t, i) => {
    if (!t.givenName.trim()) e[`t${i}-given`] = `Traveller ${i + 1}: enter first and middle names as on the ID.`;
    if (!t.familyName.trim()) e[`t${i}-family`] = `Traveller ${i + 1}: enter the surname as on the ID.`;
    if (!t.title) e[`t${i}-title`] = `Traveller ${i + 1}: choose a title. The seller needs it on the booking.`;
    if (!t.gender) e[`t${i}-gender`] = `Traveller ${i + 1}: choose the gender shown on the ID.`;
    if (!t.bornOn) e[`t${i}-dob`] = `Traveller ${i + 1}: enter a date of birth.`;
    else {
      const a = ageOn(t.bornOn, travelDateIso);
      if (a === null || a < 0 || a > 120) e[`t${i}-dob`] = `Traveller ${i + 1}: that date of birth isn't valid.`;
      else if (t.age !== null && a !== t.age)
        e[`t${i}-dob`] = `Traveller ${i + 1} would be ${a} on the travel date, but the search used ${t.age}. Prices depend on age, so search again or fix the date.`;
    }
    if (policy.required) {
      const d = t.document;
      if (!d.type) e[`t${i}-doctype`] = `Traveller ${i + 1}: choose the ID document they'll travel with.`;
      else if (policy.accepted.length && !policy.accepted.includes(d.type))
        e[`t${i}-doctype`] = `Traveller ${i + 1}: this seller doesn't accept that document type.`;
      if (!d.number.trim()) e[`t${i}-docnum`] = `Traveller ${i + 1}: enter the document number.`;
      if (!/^[A-Za-z]{2}$/.test(d.issuingCountry.trim()))
        e[`t${i}-doccountry`] = `Traveller ${i + 1}: enter the issuing country as two letters, e.g. DE.`;
      if (!d.expiresOn) e[`t${i}-docexp`] = `Traveller ${i + 1}: enter the document's expiry date.`;
      else if (d.expiresOn <= travelDateIso)
        e[`t${i}-docexp`] = `Traveller ${i + 1}: this document expires before the trip.`;
    }
  });
  if (!contact.email.trim()) e.email = "Enter an email address. Tickets and updates go there.";
  else if (!EMAIL.test(contact.email.trim())) e.email = "That email address doesn't look complete, e.g. name@example.com.";
  const phone = normalisePhone(contact.phone);
  if (!contact.phone.trim()) e.phone = "Enter a mobile number with country code. Sellers use it for disruption alerts.";
  else if (!E164.test(phone))
    e.phone = phone.startsWith("+")
      ? "That number doesn't look complete. Use + country code then the number, e.g. +49 30 1234567."
      : "Start with + and the country code, e.g. +49 for Germany.";
  return e;
}

export function toBookingPassengers(travellers: TravellerDraft[], policy: DocumentPolicy): BookingPassenger[] {
  return travellers.map((t) => ({
    passengerId: t.passengerId,
    givenName: t.givenName.trim(),
    familyName: t.familyName.trim(),
    bornOn: t.bornOn,
    title: t.title as Exclude<Title, "">,
    gender: t.gender as Exclude<Gender, "">,
    // Documents only when the supplier says they're required.
    identityDocuments:
      policy.required && t.document.type
        ? [
            {
              type: t.document.type,
              uniqueIdentifier: t.document.number.trim(),
              issuingCountryCode: t.document.issuingCountry.trim().toUpperCase(),
              expiresOn: t.document.expiresOn,
            },
          ]
        : [],
  }));
}

export function toBookingContact(c: ContactDraft): BookingContact {
  return { email: c.email.trim(), phoneNumber: normalisePhone(c.phone) };
}

export function toCreateOrderRequest(input: {
  quoteId: string;
  idempotencyKey: string;
  travellers: TravellerDraft[];
  contact: ContactDraft;
  travelDateIso: string;
  policy: DocumentPolicy;
  acceptChanges: boolean;
}): CreateOrderRequest {
  const { travellers, travelDateIso } = input;
  return {
    quoteId: input.quoteId,
    idempotencyKey: input.idempotencyKey,
    email: input.contact.email.trim(),
    passengers: travellers.map((t) => ({
      id: t.passengerId,
      age: t.age ?? ageOn(t.bornOn, travelDateIso) ?? 0,
      discounts: t.discounts.map((d) => ({
        scheme: d.scheme,
        provider: null,
        cardReference: d.cardReference || null,
      })),
    })),
    ...(input.acceptChanges ? { acceptChanges: true } : {}),
    travellers: toBookingPassengers(travellers, input.policy),
    contact: toBookingContact(input.contact),
  };
}

export function toUpdateTravellersRequest(
  travellers: TravellerDraft[],
  contact: ContactDraft,
  policy: DocumentPolicy,
): UpdateTravellersRequest {
  return { travellers: toBookingPassengers(travellers, policy), contact: toBookingContact(contact) };
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

// ---------- Order workflow ----------

export type Phase = OrderWorkflow["phase"];
export type NextAction = OrderWorkflow["nextAction"];

export const PHASES: Phase[] = [
  "needs_travellers",
  "ready_to_reserve",
  "reserving",
  "reserved",
  "ready_for_checkout",
  "awaiting_payment",
  "settling_supplier",
  "fulfilling",
  "complete",
  "needs_acceptance",
  "manual_review",
  "failed",
  "expired",
];

/** Happy-path order, used for the progress list. Exceptions sit outside it. */
export const PROGRESS: Phase[] = [
  "needs_travellers",
  "ready_to_reserve",
  "reserving",
  "reserved",
  "ready_for_checkout",
  "awaiting_payment",
  "settling_supplier",
  "fulfilling",
  "complete",
];

export const PHASE_COPY: Record<Phase, { title: string; step: string; body: string; tone: Tone }> = {
  needs_travellers: {
    title: "We need traveller details",
    step: "Traveller details",
    body: "Add names, dates of birth and contact details so the seller can book the right people.",
    tone: "info",
  },
  ready_to_reserve: {
    title: "Ready to reserve",
    step: "Ready to reserve",
    body: "Details are complete. Next we ask the seller to reserve your seats. Nothing is charged at this step.",
    tone: "info",
  },
  reserving: {
    title: "Reserving with the seller",
    step: "Reserving",
    body: "Waiting for the seller to confirm a reservation. This page checks again by itself.",
    tone: "info",
  },
  reserved: {
    title: "Reserved, not paid",
    step: "Reserved",
    body: "The seller is holding this booking. Nothing has been charged and there are no tickets yet.",
    tone: "info",
  },
  ready_for_checkout: {
    title: "Ready to pay",
    step: "Ready to pay",
    body: "Continue to the payment provider's secure page. Wayward never sees your card.",
    tone: "lime",
  },
  awaiting_payment: {
    title: "Waiting for the payment provider",
    step: "Payment",
    body: "We're waiting for the payment provider to tell us the outcome. Nothing is ticketed yet.",
    tone: "info",
  },
  settling_supplier: {
    title: "Settling with the seller",
    step: "Paying the seller",
    body: "We're completing payment to the seller. Your own payment status is shown separately below. Tickets aren't issued yet.",
    tone: "info",
  },
  fulfilling: {
    title: "Waiting for tickets",
    step: "Tickets",
    body: "The seller is issuing tickets. They appear below only once the seller actually issues them.",
    tone: "info",
  },
  complete: {
    title: "Booked and ticketed",
    step: "Done",
    body: "Every part is booked and the seller has issued your documents. They're listed below.",
    tone: "ok",
  },
  needs_acceptance: {
    title: "Something changed",
    step: "Check changes",
    body: "The price, times or conditions changed. Check the new terms and accept them before anything continues.",
    tone: "warn",
  },
  manual_review: {
    title: "A person needs to check this",
    step: "Manual review",
    body: "Something needs a human to look at it, so nothing will be retried automatically.",
    tone: "warn",
  },
  failed: {
    title: "The booking failed",
    step: "Failed",
    body: "This order didn't go through. Check your payment status below before trying again.",
    tone: "danger",
  },
  expired: {
    title: "This order expired",
    step: "Expired",
    body: "The offer or hold ran out before it was completed. Search again for current prices.",
    tone: "neutral",
  },
};

export const TERMINAL: Phase[] = ["complete", "failed", "expired"];
export const DEFAULT_POLL_MS = 2000;

export interface WorkflowView {
  phase: Phase;
  title: string;
  body: string;
  tone: Tone;
  nextAction: NextAction;
  terminal: boolean;
  checkoutReady: boolean;
  reasons: string[];
  /** Only set while nextAction is "poll". */
  pollMs: number | null;
  paymentRequiredBy: string | null;
  priceGuaranteeExpiresAt: string | null;
  progressIndex: number; // -1 for exception phases
}

export function toWorkflowView(w: OrderWorkflow): WorkflowView {
  const c = PHASE_COPY[w.phase];
  return {
    phase: w.phase,
    title: c.title,
    body: c.body,
    tone: c.tone,
    nextAction: w.nextAction,
    terminal: TERMINAL.includes(w.phase),
    checkoutReady: w.checkoutReady,
    reasons: w.reasons,
    pollMs: w.nextAction === "poll" ? (w.retryAfterMs ?? DEFAULT_POLL_MS) : null,
    paymentRequiredBy: w.paymentRequiredBy,
    priceGuaranteeExpiresAt: w.priceGuaranteeExpiresAt,
    progressIndex: PROGRESS.indexOf(w.phase),
  };
}

// ---------- Orders ----------

type OrderState = Order["state"];
type BookingState = Order["bookings"][number]["state"];

const ORDER_STATE: Record<OrderState, { label: string; tone: Tone; explain: string }> = {
  draft: { label: "Draft", tone: "neutral", explain: "Saved, not booked. Nothing has been reserved or charged." },
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
export interface SupplierDocumentView {
  id: string;
  typeLabel: string;
  reference: string;
  downloadUrl: string | null;
  issuedAt: string | null;
  observedAt: string;
  travellerCount: number;
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
  supplierDocuments: SupplierDocumentView[];
  aftersales: { refund: string; exchange: string; cancellation: string };
}
export interface OrderView {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  environment: "test" | "live" | null;
  state: OrderState;
  stateLabel: string;
  tone: Tone;
  explain: string;
  total: PriceView;
  paymentLabel: string;
  fulfilmentLabel: string;
  bookings: BookingView[];
  ticketCount: number;
  workflow: WorkflowView | null;
}

function docTypeLabel(t: string) {
  const known: Record<string, string> = {
    electronic_ticket: "E-ticket",
    eticket: "E-ticket",
    pnr: "Booking reference",
    booking_reference: "Booking reference",
  };
  return known[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
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
    // Tickets come only from bookings[].tickets.
    tickets: b.tickets.map((t) => ({
      id: t.id,
      typeLabel: DOC_TYPE[t.type],
      downloadUrl: t.downloadUrl,
      reference: t.reference,
      issuedAt: t.issuedAt,
    })),
    supplierDocuments: (b.supplierDocuments ?? []).map((d) => ({
      id: d.id,
      typeLabel: docTypeLabel(d.documentType),
      reference: d.reference,
      downloadUrl: d.downloadUrl,
      issuedAt: d.issuedAt,
      observedAt: d.observedAt,
      travellerCount: d.passengerProviderIds.length,
    })),
    aftersales: b.aftersales,
  }));
  return {
    id: o.id,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt ?? null,
    environment: o.environment ?? null,
    state: o.state,
    stateLabel: s.label,
    tone: s.tone,
    explain: s.explain,
    total: toPriceView(o.total),
    paymentLabel: PAYMENT[o.payment],
    fulfilmentLabel: FULFILMENT[o.fulfillment],
    bookings,
    ticketCount: bookings.reduce((n, b) => n + b.tickets.length, 0),
    workflow: o.workflow ? toWorkflowView(o.workflow) : null,
  };
}
