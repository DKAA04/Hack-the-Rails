# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

European travellers planning a trip from A to B who would happily mix flights, trains, coaches, ferries and local connections if they could compare them honestly in one place. They are price- and time-sensitive, plan mostly on a laptop, and check status and tickets on a phone while travelling. Wayward is a production search-and-booking product for these people, positioned as "Skyscanner, but better" for multimodal Europe.

## Product Purpose

Find, compare, combine and (once suppliers allow it) book complete European journeys across every mode. Success means a traveller picks a journey confidently because they understand its price, seller, conditions and transfer risk, without having to cross-check five other sites.

## Positioning

Every transport mode is treated equally, and the product says plainly what it knows and what it does not: what kind of price it is (live offer, test offer, indicative, historical, tariff range, unknown), who sells it, what the conditions are, how tight a transfer is. Unknown values stay unknown. Wayward never fabricates inventory, prices, bookings, charges or tickets. A metasearch competitor cannot truthfully copy that candour.

## Operating Context

- Search: resolved places (opaque supplier IDs via place lookup with visible source attribution), dates, per-passenger ages, discounts and bags, allowed modes, preferences, and optional natural-language text.
- Results: offers from connected suppliers (e.g. Duffel flights) and timetable journeys from public timetable sources (e.g. VBB), which have unknown price and cannot be booked.
- Trip workspace: combine legs from different sellers and modes, check for conflicts, then revalidate before an order.
- Checkout, payment (Stripe), supplier settlement and ticket fulfilment are separate states; a payment never implies a ticket.

## Capabilities and Constraints

- Contract v1 lives in packages/contracts; the frontend consumes it only through apps/web/src/lib/api-client.ts and one mapper layer per feature.
- Live today (backend branch): place lookup, search with persisted status and provider statuses, Duffel offer search where credentials exist, VBB regional timetables, quote revalidation.
- Not implemented: natural-language parsing, order creation, checkout/payment (typed 501), ticket issuance, customer accounts and order history.
- "Most comfortable" currently means fewest transfers; there is no verified comfort score.
- Return searches are unsupported for timetable sources.
- Only NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY may reach the browser.

## Brand Commitments

- Name: Wayward. Lines in use: "Good trips. Straight answers." "A timetable is not a reservation. A payment is not a ticket."
- Voice: candid, useful, confident. Microcopy states what it knows ("Cheapest is 2h slower, and it's a coach, not a train").
- Brand colours are ink navy and electric lime (user-specified; details live in DESIGN.md).

## Evidence on Hand

No customers, testimonials, partnerships or traffic figures. Do not invent them. Sample data may exist only in clearly named fixture files and must be labelled "Sample data" in the UI.

## Product Principles

1. Unknown stays unknown: never render a guess as a fact, a zero, or a "free".
2. Modes are peers: no mode gets visual or ranking privilege by default.
3. Explain every recommendation: each pick carries a plain-language reason.
4. Show the seams: transfers, sellers, price kinds and provider failures are visible, not hidden.
5. Fail loudly and helpfully: partial, unavailable and error states say what happened and what to do.

## Accessibility & Inclusion

WCAG 2.2 AA. Full keyboard-only flow from search through results to checkout, visible focus, labelled controls, accessible form errors, 4.5:1 text contrast, prefers-reduced-motion honoured.
