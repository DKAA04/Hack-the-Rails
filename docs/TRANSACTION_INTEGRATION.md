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

Endpoint contracts: PUT /api/orders/:id/travellers accepts `{travellers:BookingPassenger[],contact:BookingContact}` and returns Order; POST /api/orders/:id/reserve accepts `{idempotencyKey:string}` and returns Order; POST /api/orders/:id/reconcile accepts no body and returns Order. These endpoints are implemented in the order-workflow implementation commit; use the commit announcement as the adoption point.

Poll GET order status while workflow.nextAction is poll, at retryAfterMs or 2000ms. Never present authorization as capture or supplier settlement as ticket issuance. Only display ticket documents actually returned in bookings[].tickets. Complete/failed/expired are terminal; manual_review requires support and must not trigger automatic booking retries. Price/condition changes require explicit customer acceptance via a new revalidation and draft. A reservation alone does not imply a protected price unless priceGuaranteeExpiresAt is still valid.

SupplierBooking adds optional `supplierDocuments: Array<{id:string,documentType:string,reference:string,downloadUrl:string|null,issuedAt:Utc|null,observedAt:Utc,passengerProviderIds:string[]}>`. Duffel electronic-ticket responses may supply a reference without a PDF URL or issuance timestamp: display the real reference; keep unknown URL/time null. Existing tickets[] is unchanged and is populated only when all its required fields are actually known. No PDFs or issuance timestamps are fabricated.

## Working workflow and frontend actions

All routes are same-origin Next.js API routes. Merge backend into the frontend branch and run the integrated app on the port in that laptop's APP_URL (this checkout uses 3001). Do not point a browser at an unrelated cross-origin API and expect the HttpOnly cookie to work.

1. POST /api/search ? SearchReceipt. GET /api/search/:id ? SearchResult. Choose an actual Offer, never a timetableJourney.
2. POST /api/quotes/revalidate `{searchId,offerIds:[offer.id]}` ? RevalidationResponse. Display changed price, conditions.summary (including supplier penalty details), services and itinerary. Confirm changes explicitly before POST /api/orders with acceptChanges:true.
3. POST /api/orders with the existing passenger IDs/ages plus optional travellers/contact ? Order; keep the HttpOnly session cookie. A PostgreSQL database is required. Missing SQL credentials returns typed 503, not a file-backed customer order.
4. PUT /api/orders/:id/travellers ? Order with nextAction reserve after validation. Contact requires email and E.164 phone. Dates of birth must match ages at departure. Unsupported infant association or document types fail explicitly before supplier creation.
5. POST /api/orders/:id/reserve `{idempotencyKey}` ? Order. Only this specific offer's confirmed hold capability permits reservation. Hold creates no customer payment. Duplicate keys/requests never automatically create another supplier order. Instant-only/live offers are rejected.
6. If workflow.checkoutReady, POST /api/payments/checkout `{orderId,idempotencyKey}` ? `{sessionId,redirectUrl}`. Redirect to the returned actual Stripe URL. Per-order readiness requires an actual supplier hold, matching accepted total/conditions, sufficient known guarantee/deadline, traveller details, PostgreSQL and a verified test Stripe account. Missing unrelated ground-provider credentials do not disable a ready Duffel order. Checkout creation uses stable Stripe idempotency.
7. On return from Stripe, POST /api/orders/:id/reconcile (no body), then GET /api/orders/:id. While nextAction=poll, repeat POST reconcile plus GET every retryAfterMs (default 2000ms). POST reconcile is session-protected and may advance the already-authorized **test** transaction; GET status is read-only. Reconciliation works without a webhook signing secret; production reliable event delivery still requires proper webhook setup.
8. Authorization is payment=authorized, not a ticket. Backend checks current supplier total/conditions/expiry, settles the supplier once, reads actual fulfillment, and captures the authorized customer payment only after the supplier returns all required electronic-ticket references. Display bookings[].supplierDocuments, including null issuance times/URLs. Confirm the trip only when order.state=confirmed and workflow.phase=complete.

Errors use the existing ApiError schema. 400 invalid/missing identity data; 401 missing session/signature; 404 inaccessible/unknown order; 409 expired/changed/ineligible state; 501 unsupported supplier/instant/infant operation; 503 missing credentials or transient service failure. Retriable Stripe creation uses the same provider idempotency key. Do not automatically retry supplier creation or settlement after uncertain outcomes: manual_review/contact_support requires reconciliation/support, never a new idempotency key. If capture is uncertain after ticket issuance, actual tickets remain visible and no supplier reversal is assumed.

Complete, failed and expired are terminal display states. needs_acceptance requires a new search/revalidation/draft; existing unpaid holds are left to expire rather than pretending a paid nonrefundable ticket can be reversed. A definitive supplier payment rejection before settlement may release an uncaptured Stripe authorization. Ambiguous supplier payment retains manual_review and does not automatically release/cancel/rebook. Partial fulfillment remains pending/partial until actual provider documents cover all passengers. After capture/ticket issuance, refunds/aftersales require a separately supported supplier workflow; this implementation does not automatically reverse travel purchases.

GET /api/health/dependencies adds optional checkoutPolicy="per_order_test_only". Legacy stripe.checkoutEnabled remains false as a blanket global enable flag; use each Order.workflow.checkoutReady instead. No new dependencies or lockfile changes are required for this increment.

GET /api/capabilities adds optional `paymentProvider:{id:"stripe",credentialsPresent:boolean,connectivity:"not_checked"|"verified"|"failed",environment:"test"|"live"|"unknown"}`. Stripe inspection performs a real read-only account probe (cached for 60 seconds); payments="available" means the test integration can be called subject to each order's readiness, not blanket permission to charge. Missing unrelated supplier keys do not change it. Existing fields remain valid; consumers on old schemas may ignore the optional inspection detail. No secret values or balances are returned.
Automated aftersales is not implemented; offer/order aftersales capability values stay unknown or explicitly unsupported even when the supplier fare terms allow a refund/change. Render the fare policy in conditions.summary without inventing a working refund/exchange action. Cancelled or partially fulfilled supplier children cannot authorize capture merely because a document reference remains present.
