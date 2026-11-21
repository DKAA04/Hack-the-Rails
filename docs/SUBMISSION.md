# Wayward submission pack

## Links

- Working demo: https://wayward-nine.vercel.app
- Repository: https://github.com/DKAA04/Hack-the-Rails
- Setup and architecture: [README](../README.md)
- Actual deployed source: https://wayward-nine.vercel.app/api/health/release
- Service evidence: [SERVICE_EVIDENCE.md](SERVICE_EVIDENCE.md)
- Deployment boundaries: [DEPLOYMENT.md](DEPLOYMENT.md)

The verified running release at preparation time is `cfaf8b38fb45596dbb417340591d7f59cff26289`. The release endpoint is authoritative for subsequent deployments. Documentation changes alone do not establish new runtime verification.

## Submission description

Wayward is a European multimodal travel workspace with a candid rule: show what is known, say what is missing. Travellers resolve real places, compare actual supplier flight offers and regional timetable journeys, assemble a trip, review refreshed prices and conditions, and follow a supported flight through test payment, supplier settlement and fulfillment. Flights, trains, coaches, ferries and local connections share canonical contracts; timetable availability is never presented as a reserved seat or purchasable ticket.

The working transaction integration uses Duffel and Stripe test environments with durable Supabase PostgreSQL orders. Authorization, supplier settlement, capture and fulfillment stay separate. Signed webhooks and protected reconciliation advance an existing order; uncertain supplier outcomes are not automatically rebooked. Actual supplier references are displayed without invented PDFs, prices or issuance timestamps.

## Three-minute walkthrough

1. **0:00–0:25 — Product.** Open the hosted demo. Show multimodal controls and actual connected/unavailable sources. State that transactions use test environments.
2. **0:25–1:05 — Search.** Resolve places with autocomplete and select a future date. For the supplier's designated sandbox hold scenario, use JFK → EWR, one adult and no extra bags. This US test route demonstrates transaction machinery, not European commercial coverage. Select an offer explicitly supporting a hold. Show total, timings and seller conditions.
3. **1:05–1:45 — Acceptance.** Add the journey to the trip, revalidate, review changes and provide synthetic test traveller/contact information consistent with the passenger age. Accept the refreshed total/conditions. A draft and unpaid hold are not tickets.
4. **1:45–2:25 — Transaction.** If a fresh transaction is needed, use the returned Stripe test Checkout with test card 4242 4242 4242 4242, future expiry and test CVC. Return in the same browser session. For an already confirmed order, open its status rather than buying again. Show payment, supplier settlement and fulfillment separately.
5. **2:25–3:00 — Evidence and scope.** Show the actual electronic-ticket reference, refresh/revisit and unknown PDF/issuance fields. Show a regional timetable separately: unknown price, no checkout. Close with pending commercial ground access and live activation.

Supplier timing can exceed this narration budget. When a service is unavailable, show its actual unavailable/error state. Do not substitute sample orders or invented bookable inventory as transaction evidence.

## Evidence snapshot

| Capability                    | Evidence at preparation time                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh browser transaction     | User-completed local browser test on localhost:3000; Claude af71e32 records return and displayed reference                                     |
| Independent transaction reads | Confirmed/captured/fulfilled; one supplier order, one successful supplier payment and actual electronic-ticket reference; no purchase repeated |
| Hosted delivery and access    | Genuine signed mapped webhook and duplicate replay return 200; missing/foreign guest sessions return 401/404                                   |
| PostgreSQL                    | Commit/rollback, RLS and duplicate checks pass; both TLS legs encrypted after enforcement; client certificate validation enabled               |
| Release checks                | Typecheck, 46 deterministic tests and production build passed for cfaf8b3                                                                      |
| Fresh hosted-browser return   | Owner is testing; record exact-order evidence after its ID/result is supplied                                                                  |

Start the hosted test at the hosted URL and preserve that browser's session cookie. Old local Checkouts embed localhost return URLs and cannot prove a hosted return. Private cookies, credentials and traveller documents are not submission artifacts.

## Actual Track 2 requirements

**No official brief found in the inspected repository.** Tracked documentation and local Markdown/PDF notes contain no official Track 2 brief, submission form, deadline, video length, judging rubric or mandatory deliverables. No compliance claim is made for an unseen brief. An official brief/form URL or repository path is needed to verify these requirements.

These links, description and walkthrough are prepared materials, not an invented Track 2 checklist. The owner must confirm the official submission destination, team/member details, required attachments, permitted test/demo format and deadline from organizer instructions.

## Current limitations

Test transactions only; no live supplier/merchant activation. Commercial rail/coach/ferry purchasing, multi-supplier protected purchases, instant-only flights, infant association, automated aftersales, full accounts/recovery and natural-language parsing remain unavailable or unfinished. Regional timetables are non-bookable. A provider reference may lack a PDF or issuance timestamp; those stay unknown. The product scope remains European and multimodal; current sandbox transaction evidence uses the supplier's designated test scenario.
