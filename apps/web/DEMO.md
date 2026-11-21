# Wayward: 3-minute walkthrough

Hosted test environment: https://wayward-nine.vercel.app. Every step below was run end to end in a real browser against the sandbox services (Duffel test mode, Stripe test mode, PostgreSQL). Nothing here is a live ticket sale.

Use one browser window from start to finish: orders open only in the browser session that created them.

Items marked † are in the latest `feat/frontend` commits and appear on the hosted site once that commit is deployed (hosted currently runs `cfaf8b3`).

## Steps (about 3 minutes)

| Time | Do this | What the screen shows |
| --- | --- | --- |
| 0:00 | Open the home page and scroll to **What's connected right now**. | Duffel (flights) searching, public timetables (Berlin and Brandenburg, times only), integrations not built yet, order storage connected, payments in test mode. |
| 0:15 | **From**: type `John F Kennedy` and pick **John F. Kennedy International Airport** (hint underneath reads *Airport, United States*). **To**: type `Newark Liberty` and pick **Newark Liberty International Airport**. **Depart**: a date about two weeks ahead (use the calendar picker or type the full date). Leave 1 traveller. Press **Find journeys**. | Only places picked from the list can be searched. Pick the row labelled *Airport*: a city or Berlin stop may be listed above it. |
| 0:40 | Results. | "Answered by Duffel." Cheapest / Fastest / Most comfortable tabs, each with a **Why this one** reason. Every card is marked **Test price** and **Test booking · no real ticket**. The same flight appears at different prices; the **Fare** line† explains why (for example *Non-refundable · changes €10.00* vs *Refundable, €10.00 fee*). Open **Details** for the timeline, the price breakdown (base fare, taxes, *Wayward fee: none added*) and the seller's fare rules†. |
| 1:05 | Press **Add to trip** on the cheapest card, then **Trip** in the navigation. | Trip total, "Connections line up", **Continue to checkout**. |
| 1:15 | **Continue to checkout**. Fill traveller 1: first names `Ana`, surname `Tester`, title `Ms`, gender `Female`, date of birth `1996-01-01` (age 30, matching the search). Email `sandbox@example.com`, mobile `+44 20 8016 0508`. Press **Check price and seats**. | A **Test booking** notice. Then the seller check: **Price confirmed**, with how long the quote is valid. If the price or times changed, the panel asks you to accept the change first. |
| 1:35 | **Create order**, then **Reserve with the seller**. | The order goes from *Ready to reserve* to **Ready to pay**, with *Pay by* and *Price guaranteed until* times from the seller. The booking reads *Reserved, not ticketed*; your payment reads *Not started*. |
| 1:55 | **Continue to test payment**. On Stripe's *Sandbox* page enter card `4242 4242 4242 4242`, expiry `12 / 34`, CVC `123`, any name, and press **Pay**. | Stripe's hosted test Checkout for the same total. |
| 2:20 | Wait for the return. | You land back on the Wayward order page ("Back from payment. We're checking…"), which reconciles with Stripe and the seller. |
| 2:30 | Read the order. | **Booked and ticketed**. Order record *Confirmed*, your payment *Paid*, tickets *All tickets issued*, shown separately. Booking *Booked via Duffel · ref ord_…* and an **E-ticket** reference. The seller gives no PDF or issue time, and the page says so. |
| 2:45 | Refresh, then open **Orders**. | The same order and status come back in this browser session. The Orders list shows each order's status, payment and ticket states†. |

Optional, if time allows: search `S+U Berlin Hauptbahnhof` → `S Potsdam Hauptbahnhof` with Trains and Local switched on. Real departures show as a departure board with no price and no booking.

## What is real, what is test, what isn't available

- **Real:** place lookup (GeoNames, VBB, Duffel airports); Berlin and Brandenburg public timetables (real departures, **unpriced and not bookable**); order storage in PostgreSQL; the order workflow, Stripe reconciliation and supplier reference shown on the order.
- **Test mode:** flights are **Duffel sandbox test offers**: holds, settlement and the e-ticket reference come from Duffel's test environment. Payment is **Stripe test mode**. **No real ticket is issued and no real money moves.**
- **Not available:** rail, coach and ferry **booking** suppliers (none connected); **live ticket sales** of any kind; account sign-in or recovery (orders open only in the originating browser session); flight offers that can't be held first; refunds and changes through Wayward; choosing a time of day; reading a trip typed as a sentence.

## If a step fails live

1. **Wrong place or no airport in the list:** type more of the name (`John F Kennedy`, `Newark Liberty`) and pick the row labelled *Airport*. The place ranking is a known backend issue.
2. **"Price or times changed", "This offer has expired" or a reserve error:** press **Refresh** on the results (or **Edit search**) and repeat with a fresh offer. Sandbox offers expire after about 30 minutes.
3. **The return from Stripe doesn't settle:** open **Orders** in the same browser, then the order, then **Check again**. If the session was lost, show the labelled preview at `/orders/sample?sample=confirmed` (marked **Sample data**) and say so.
