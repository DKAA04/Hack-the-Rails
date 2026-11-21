# Backend development

Current deployed verification (2026-11-21): see [DEPLOYMENT.md](DEPLOYMENT.md). Both Supabase TLS legs now pass after owner SSL enforcement; private-schema transactions still pass. Local CLI and hosted Stripe signed delivery have been verified with distinct endpoint secrets. A fresh browser test on localhost:3000 also completed with a single supplier order/payment, capture and an actual ticket reference. Earlier missing-secret and upstream-TLS notes below record previous checkpoints and are superseded by that evidence. A fresh hosted-browser return remains a separate verification step.

Work on feat/backend. Frontend can fetch and merge origin/feat/backend to adopt additive APIs; rerun pnpm install --frozen-lockfile for the pg, @types/pg and Stripe SDK additions. No frontend-owned source files have been edited.

## Local configuration

Create apps/web/.env.local (ignored): WAYWARD_ENV=development, APP_URL=http://localhost:3000, DATABASE_URL with a Supabase PostgreSQL session-pooler connection string, STRIPE_SECRET_KEY with a test-mode secret, STRIPE_WEBHOOK_SECRET from your test webhook destination/local listener, DUFFEL_ACCESS_TOKEN with a Duffel test token. Only configure keys you actually have; blank keys disable affected operations. Do not put the Supabase database password, service key, Stripe secret or supplier token in NEXT_PUBLIC variables.
Use Supabase Dashboard ? Connect ? Session pooler; project URL/anon key are not SQL credentials. Keep TLS verification enabled and use the provider's documented connection settings. The database role needs permission to create wayward_private schema/table or apply the documented schema in advance. The backend only modifies its own schema. Database connectivity may be verified at /api/health/dependencies without performing supplier or payment actions.

## Commands

pnpm dev; pnpm typecheck; pnpm test; pnpm build. With the production or dev server running on port 3001, node scripts/backend-smoke.mjs calls real place and VBB timetable APIs and verifies persisted status/results and non-bookability. Set SMOKE_URL for another port. This external smoke check depends on actual source availability. pnpm test remains deterministic and never sends supplier bookings or payment requests.

## Verified configured services

Stripe test account access, hosted Checkout creation, manual authorization/capture, actual Duffel offers/repricing/hold/test balance settlement and an actual supplier electronic-ticket reference were verified. Once DATABASE_URL was supplied, real PostgreSQL private-schema/RLS permissions, transactions, rollback, duplicate handling, persisted search/orders, protected sessions and traveller updates were verified. The user completed the test Checkout and Wayward's protected reconciliation route reached confirmed/captured/settled/fulfilled; this survived server restart. Concurrent reconciliation left one supplier order and one successful supplier payment. See SERVICE_EVIDENCE.md for the separation between standalone API checks and the full durable test.

No live funds or real travel purchases were authorized. STRIPE_WEBHOOK_SECRET is still absent, so real signed webhook delivery remains unverified; the completed test used reconciliation. Ground supplier access is still missing. Automated aftersales, instant-only purchases and multi-supplier purchasing remain unfinished, not hidden behind successful-looking responses.

## Remaining work after access

Verify the chosen supplier's real sandbox offers and capabilities, including bags, transfer protections, expiry, holds and fulfillment. Coordinate additive passenger identity/contact/document contracts with frontend before booking implementation. Build idempotent supplier booking/settlement plus explicit failure/reconciliation and compensation handling before enabling customer Checkout. Full multimodal supplier coverage, cross-provider composition/protected transfers, account recovery and supported aftersales remain separate work. Regional timetables are not substitutes for commercial rail/coach/ferry supplier access.

Official references: https://docs.stripe.com/webhooks ; https://docs.stripe.com/api/checkout/sessions/create ; https://supabase.com/docs/guides/database/connecting-to-postgres ; https://node-postgres.com/features/ssl .

## Transaction workflow update

Current implementation and customer actions are in TRANSACTION_INTEGRATION.md; actual service evidence is in SERVICE_EVIDENCE.md. The previous "Checkout remains disabled regardless of key presence" note describes the older increment. Checkout is now conditional on the individual order's verified supplier hold and test configuration. Database absence still blocks customer-order persistence. No file fallback is used for orders/payments. New private-schema migration: packages/server/src/db/migrations/001-records.ts; it is additive and runs under a PostgreSQL transaction/advisory lock. Only wayward_private is modified.
Run `pnpm exec tsx scripts/verify-database.ts` after setting DATABASE_URL to verify schema privileges, RLS, committed writes, rollback and duplicate protection against the actual SQL connection. Do not claim the development file adapter as Supabase. Run the transaction HTTP smoke checker against a freshly started app matching APP_URL to verify actual search/order/session behavior. Do not reuse an older process on port 3000 when APP_URL is 3001.
Stripe CLI setup (manual, when available): `stripe listen --events checkout.session.completed,checkout.session.expired,payment_intent.amount_capturable_updated,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled --forward-to http://localhost:3001/api/webhooks/stripe`. Put the listener's signing secret in STRIPE_WEBHOOK_SECRET privately, then restart the app. Never print or commit it. An actual signed event/delivery must still be verified; signature unit tests alone do not establish delivery.

## Verified Supabase client TLS

The backend forces certificate/hostname verification for Supabase connection URLs using the vendor's public CA embedded in packages/server/src/db/supabase-ca.ts. This is public trust material, not an API key, and requires no extra environment variable. SSL query flags cannot silently turn verification off for Supabase hosts. Local PostgreSQL behavior remains controlled by its own connection settings. The current client connection was externally verified as encrypted and authorized; SQL persistence/rollback checks passed over that connection.
The operator still needs to enable Supabase project SSL enforcement (Database Settings ? SSL Configuration) to require TLS on both client/pooler and pooler/database legs; the pooled SQL view currently reports the latter as false. This server-wide change is outside the authorized additive private-schema migrations, so it was left untouched. See SERVICE_EVIDENCE.md and Supabase's official SSL enforcement documentation for the distinction. No live/customer-data readiness is claimed until outstanding operational work is addressed.
