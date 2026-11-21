import { z } from "zod";
import { IdSchema, UtcSchema } from "./common";
export const BookingContactSchema = z.object({
  email: z.email(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
});
export type BookingContact = z.infer<typeof BookingContactSchema>;
export const IdentityDocumentSchema = z.object({
  type: z.enum(["passport", "identity_card"]),
  uniqueIdentifier: z.string().trim().min(1).max(128),
  issuingCountryCode: z.string().regex(/^[A-Z]{2}$/),
  expiresOn: z.iso.date(),
});
export type IdentityDocument = z.infer<typeof IdentityDocumentSchema>;
export const BookingPassengerSchema = z.object({
  passengerId: IdSchema,
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().min(1).max(100),
  bornOn: z.iso.date(),
  title: z.enum(["mr", "ms", "mrs", "miss", "dr"]),
  gender: z.enum(["m", "f"]),
  identityDocuments: z.array(IdentityDocumentSchema).max(5).default([]),
});
export type BookingPassenger = z.infer<typeof BookingPassengerSchema>;
export const UpdateTravellersRequestSchema = z.object({
  travellers: z.array(BookingPassengerSchema).min(1).max(9),
  contact: BookingContactSchema,
});
export type UpdateTravellersRequest = z.infer<
  typeof UpdateTravellersRequestSchema
>;
export const ReserveOrderRequestSchema = z.object({ idempotencyKey: IdSchema });
export type ReserveOrderRequest = z.infer<typeof ReserveOrderRequestSchema>;
export const OfferBookingRequirementsSchema = z.object({
  holdSupported: z.boolean().nullable(),
  priceGuaranteeExpiresAt: UtcSchema.nullable(),
  paymentRequiredBy: UtcSchema.nullable(),
  identityDocumentsRequired: z.boolean().nullable(),
  supportedIdentityDocuments: z.array(z.string()),
  passengerMappings: z.array(
    z.object({ passengerId: IdSchema, providerPassengerId: IdSchema }),
  ),
});
export type OfferBookingRequirements = z.infer<
  typeof OfferBookingRequirementsSchema
>;
export const OrderWorkflowSchema = z.object({
  phase: z.enum([
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
  ]),
  nextAction: z.enum([
    "provide_travellers",
    "reserve",
    "checkout",
    "accept_changes",
    "poll",
    "contact_support",
    "none",
  ]),
  checkoutReady: z.boolean(),
  reasons: z.array(z.string()),
  retryAfterMs: z.number().int().nonnegative().nullable(),
  paymentRequiredBy: UtcSchema.nullable(),
  priceGuaranteeExpiresAt: UtcSchema.nullable(),
});
export type OrderWorkflow = z.infer<typeof OrderWorkflowSchema>;

export const SupplierDocumentSchema = z.object({id:IdSchema,documentType:z.string(),reference:z.string(),downloadUrl:z.url().nullable(),issuedAt:UtcSchema.nullable(),observedAt:UtcSchema,passengerProviderIds:z.array(IdSchema)});
export type SupplierDocument=z.infer<typeof SupplierDocumentSchema>;
