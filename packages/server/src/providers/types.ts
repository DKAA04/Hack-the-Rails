import type {
  ProviderCapability,
  SearchIntent,
  Offer,
  RevalidationRequest,
  RevalidationResponse,
  SupplierBooking,
  TicketDocument,
  Aftersales,
} from "@wayward/contracts";
export interface ProviderAdapter {
  inspect(): ProviderCapability;
  search?: (intent: SearchIntent) => Promise<Offer[]>;
  reprice?: (request: RevalidationRequest) => Promise<RevalidationResponse>;
  reserve?: (
    quoteId: string,
    idempotencyKey: string,
  ) => Promise<{ reservationId: string; expiresAt: string }>;
  book?: (
    reservationOrQuoteId: string,
    idempotencyKey: string,
  ) => Promise<SupplierBooking>;
  retrieveFulfillment?: (bookingId: string) => Promise<TicketDocument[]>;
  aftersales?: (
    bookingId: string,
    action: keyof Aftersales,
    idempotencyKey: string,
  ) => Promise<{
    requestId: string;
    state: "pending" | "completed" | "rejected";
  }>;
}
