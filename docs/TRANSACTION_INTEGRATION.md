# Transaction integration: additive v1 contract

This document is the current frontend handoff. Existing SearchIntent, Order and CreateOrderRequest fields remain valid.

## Passenger information

CreateOrderRequest adds optional `travellers: BookingPassenger[]` and `contact: BookingContact`. A draft may omit them; reservation and checkout may not.

BookingPassenger: `{passengerId:string, givenName:string, familyName:string, bornOn:"YYYY-MM-DD", title:"mr"|"ms"|"mrs"|"miss"|"dr", gender:"m"|"f", identityDocuments:Array<{type:"passport"|"identity_card",uniqueIdentifier:string,issuingCountryCode:string,expiresOn:"YYYY-MM-DD"}>}`. `passengerId` must reference an existing search passenger. Documents default to []; collect only documents required/accepted by the supplier. Title/gender values follow the implemented Duffel interface, rather than a general account-profile model. Backend validates age at departure, document expiry and provider-supported document types.
BookingContact: `{email:string,phoneNumber:string}`; phoneNumber is E.164, e.g. + plus country code and digits. Do not send documents in URLs or logs.

## Supplier prerequisites

Offer adds optional `bookingRequirements:{holdSupported:boolean|null,priceGuaranteeExpiresAt:Utc|null,paymentRequiredBy:Utc|null,identityDocumentsRequired:boolean|null,supportedIdentityDocuments:string[],passengerMappings:Array<{passengerId:string,providerPassengerId:string}>}`. Null means unknown, not unsupported. An offer is never held merely because holdSupported is true.

## Order status

Order adds optional `environment:"test"|"live"`, `updatedAt:Utc`, `workflow:{phase,nextAction,checkoutReady,reasons:string[],retryAfterMs:number|null,paymentRequiredBy:Utc|null,priceGuaranteeExpiresAt:Utc|null}`. Authoritative phase values: needs_travellers, ready_to_reserve, reserving, reserved, ready_for_checkout, awaiting_payment, settling_supplier, fulfilling, complete, needs_acceptance, manual_review, failed, expired. nextAction: provide_travellers, reserve, checkout, accept_changes, poll, contact_support, none.

Existing POST /api/orders and GET /api/orders/:id return Order. Creation sets the existing HttpOnly wayward_session cookie. All subsequent calls require that same browser session (same-origin fetch does this automatically). Clearing cookies loses development guest access. No full account recovery exists yet.

New endpoint contracts (published before implementation): PUT /api/orders/:id/travellers accepts `{travellers:BookingPassenger[],contact:BookingContact}` and returns Order; POST /api/orders/:id/reserve accepts `{idempotencyKey:string}` and returns Order; POST /api/orders/:id/reconcile accepts no body and returns Order. These endpoints must not be treated as working until the implementation commit is announced.

Poll GET order status while workflow.nextAction is poll, at retryAfterMs or 2000ms. Never present authorization as capture or supplier settlement as ticket issuance. Only display ticket documents actually returned in bookings[].tickets. Complete/failed/expired are terminal; manual_review requires support and must not trigger automatic booking retries. Price/condition changes require explicit customer acceptance via a new revalidation and draft. A reservation alone does not imply a protected price unless priceGuaranteeExpiresAt is still valid.

SupplierBooking adds optional `supplierDocuments: Array<{id:string,documentType:string,reference:string,downloadUrl:string|null,issuedAt:Utc|null,observedAt:Utc,passengerProviderIds:string[]}>`. Duffel electronic-ticket responses may supply a reference without a PDF URL or issuance timestamp: display the real reference; keep unknown URL/time null. Existing tickets[] is unchanged and is populated only when all its required fields are actually known. No PDFs or issuance timestamps are fabricated.
