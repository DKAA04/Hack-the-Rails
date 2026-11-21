# Wayward API contract v1

Canonical source: packages/contracts/src. All consumers import @wayward/contracts. Version 1 uses camelCase JSON and UTC ISO timestamps ending in Z, plus IANA time zones on places. Money is a nonnegative safe integer in minor units and an uppercase ISO currency code. No floating-point currency calculations. Provider IDs are opaque strings; do not parse or replace them with display names.

SearchIntent includes resolved typed places, passenger ages and discount references, dates, bag counts, modes, preferences and optional natural-language text. Natural language is input, not an implemented inference service. Place resolution must be integrated before frontend submission; raw labels must not masquerade as resolved supplier IDs.

Transport modes: flight, rail, coach, ferry, local_transit, walking, transfer. Itineraries distinguish completeness and verified compatibility; leg timing alone does not prove a valid or protected connection. Transfers record minimum buffers, location changes, protection and compatibility. Supplier capability mode lists indicate intended adapter scope, not confirmed commercial coverage.

Price.kind explicitly separates live_offer, test_offer, indicative, historical_observation, published_tariff_range and unknown. Known totals identify complete/partial status, missing components and priced components. Complete totals must include all mandatory fare, tax, service, bag, transfer and payment costs, in one currency; no silent FX conversion. Unknown prices have no numeric total. Tariff ranges are not offers. Nullable fields mean unknown, never zero or false by implication. Services absent from includedServices remain unknown. Availability and reservationState are independent of timetableStatus, crowding and seatMapAvailable. No held seat or issued ticket can be inferred from a timetable.

Offers carry seller/merchant identity, conditions, included services, provider references, freshness and expiry, availability and live/test environment. Revalidation must verify expiry, availability, complete total and customer acceptance of changes before order creation. Only live or explicitly test-environment supplier offers can reach an appropriately matching purchase environment. The skeleton does not implement those transitions.

Parent Order owns supplier child bookings. Customer payment state, supplier settlement state and fulfillment state are independent. TicketDocument requires actual supplier issuance. Aftersales refund/exchange/cancellation capabilities are explicit supported/unsupported/unknown; no capability is assumed.

| Endpoint                    | Success schema                        | Foundation behavior                                                               |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| GET /api/health             | Health                                | 200 process/config inspection, no dependency ping                                 |
| GET /api/capabilities       | Capabilities                          | 200 actual credential presence, connectivity not_checked; no operations available |
| POST /api/search            | SearchReceipt                         | 400 invalid body; 501 unimplemented                                               |
| GET /api/search/:searchId   | SearchResult                          | 501 unimplemented                                                                 |
| POST /api/quotes/revalidate | RevalidationResponse                  | 400 invalid body; 501 unimplemented                                               |
| POST /api/orders            | Order                                 | 400 invalid body; 501 unimplemented                                               |
| GET /api/orders/:orderId    | Order                                 | 501 unimplemented                                                                 |
| POST /api/payments/checkout | CheckoutResponse                      | 400 invalid body; 501 unimplemented                                               |
| POST /api/webhooks/stripe   | Future verified event acknowledgement | 503 without signing secret; 501 until verification/processing implemented         |

Errors are ApiError: {version:1,error:{code,message,retryable,requestId}}. HTTP mapping: INVALID_REQUEST 400, UNAUTHORIZED/INVALID_SIGNATURE 401, NOT_FOUND 404, CONFLICT/QUOTE_EXPIRED 409, NOT_IMPLEMENTED 501, NOT_CONFIGURED/PROVIDER_UNAVAILABLE 503, INTERNAL_ERROR 500. All responses are no-store and have X-Request-ID. Validation errors never echo request data or secrets.

POST order/checkout contracts require idempotency keys; durable idempotency, authenticated order access, rate limiting, raw Stripe signature verification and replay protection are prerequisites to enabling mutations. No payment success may imply supplier booking or ticket fulfillment. Customer sessions and production authorization are future work; current read/write order operations cannot return success.

Credential presence is inspected locally and returned only as a boolean. Provider connectivity remains not_checked until a real permitted probe succeeds. Database configured is not database reachable. Environment WAYWARD_ENV defaults to development, live must be explicit; invalid values are visible in health and must block future operations. NODE_ENV controls framework optimizations only. No secrets or environment values are sent to clients.
