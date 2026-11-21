# Hosted development release

Application: https://wayward-nine.vercel.app . This is explicitly a development/test transaction environment, despite Vercel's production deployment target. No live merchant or supplier activation is implied.

Vercel project `wayward`, scope `dkaa04s-projects`, uses Node 22, Fluid compute, Frankfurt functions, a 180-second request budget, pnpm's frozen workspace lockfile and `apps/web` as its root with shared packages included. Supplier requests and persistence are awaited within requests; there is no detached search/booking work that depends on a process surviving its response. PostgreSQL uses the existing session pooler with certificate and hostname validation. Only additive private-schema migrations run.

`APP_URL` on the host is the HTTPS application origin. Browser API calls are same-origin. Guest order cookies are HttpOnly, SameSite=Strict, Secure over HTTPS, scoped to `/api`. A customer must retain the originating browser session; account recovery is unfinished. Browser-held order IDs alone do not grant access. `/api/health/release` identifies the exact deployed source SHA.

Secrets are encrypted hosting variables, never Git files or uploaded `.env.local`. `.vercelignore` excludes environment files and private runtime checkpoints. Local and hosted Stripe signing secrets are different. The hosted endpoint uses snapshot events at `/api/webhooks/stripe`: checkout.session.completed, checkout.session.expired, payment_intent.amount_capturable_updated, payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled. It verifies the exact raw body, timestamp and signature, binds the actual Checkout/payment to a durable order, and transactionally deduplicates events. Reconciliation of an existing completed order does not create another booking.

## Verified release checks

- Strict type checking, all 45 deterministic tests, and production build passed after frontend/backend integration. Windows path and line-ending assumptions in frontend boundary tests were corrected without changing frontend source.
- Anonymous home page and release endpoint return 200. Hosted dependency inspection performs a real PostgreSQL probe and reports PostgreSQL storage.
- Hosted actual Duffel test place lookup, search, stored results, repricing, draft creation, traveller update, duplicate requests, own-session access and foreign-session rejection passed. This check creates a draft, not another supplier booking.
- The existing completed test order is retrievable through the host with its original authorized session and retains captured payment, settled supplier booking and an actual returned electronic-ticket reference. Missing sessions return 401; another valid guest session returns 404.
- A real Stripe payment_intent.succeeded event for that existing completed order was resent to the deployed endpoint. The private database records the event as complete. Its test supplier order/payment are reconciled rather than recreated. Local CLI signed delivery also returned 200; an invalid local signature returned 401.
- Supabase client TLS is encrypted with certificate authorization; commit, rollback, private-schema/RLS permissions and duplicate protection passed. The pooler-to-database SQL view still reported TLS false at the last check: owner SSL enforcement and a fresh connection check remain necessary.

Browser automation stopped because its Windows URL-policy check could not confidently identify the current browser URL. A new hosted browser Checkout completion, visual responsiveness, cookie behavior across a real Stripe browser return, and refresh/revisit must therefore remain unverified until an actual browser walkthrough is possible. Existing completed Checkout URLs used localhost; new sessions derive their return URLs from hosted APP_URL. Do not present the old local return as a hosted browser test.

## Release and submission

Integrate `integration/final` into `main` through a short PR. Deploy the exact resulting main SHA, then compare it with `/api/health/release`. From the linked repository root, `npx vercel deploy --prod --yes --scope dkaa04s-projects` builds UI and API together using host configuration. Environment changes require a new deployment. Keep WAYWARD_ENV=development and matching supplier/Stripe test credentials.

For the walkthrough, show real place autocomplete, supplier flight search, honest test-offer labels, comparison/trip workspace, repricing and passenger collection. Show the protected completed test order's independent payment/settlement/fulfillment states and actual reference only in its authorized session. Rail/local timetable results are separate and cannot be checked out. Coach/ferry/rail commercial access, live activation, account recovery, instant-only flights, multi-supplier purchasing and automated aftersales remain unfinished or blocked by access. Never claim live travel ticket sales.
