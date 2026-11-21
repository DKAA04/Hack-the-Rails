# Backend development

Work on feat/backend. Frontend can fetch and merge origin/feat/backend to adopt additive APIs; rerun pnpm install --frozen-lockfile for the pg, @types/pg and Stripe SDK additions. No frontend-owned source files have been edited.

## Local configuration

Create apps/web/.env.local (ignored): WAYWARD_ENV=development, APP_URL=http://localhost:3000, DATABASE_URL with a Supabase PostgreSQL session-pooler connection string, STRIPE_SECRET_KEY with a test-mode secret, STRIPE_WEBHOOK_SECRET from your test webhook destination/local listener, DUFFEL_ACCESS_TOKEN with a Duffel test token. Only configure keys you actually have; blank keys disable affected operations. Do not put the Supabase database password, service key, Stripe secret or supplier token in NEXT_PUBLIC variables.
Use Supabase Dashboard ? Connect ? Session pooler; project URL/anon key are not SQL credentials. Keep TLS verification enabled and use the provider's documented connection settings. The database role needs permission to create wayward_private schema/table or apply the documented schema in advance. The backend only modifies its own schema. Database connectivity may be verified at /api/health/dependencies without performing supplier or payment actions.

## Commands

pnpm dev; pnpm typecheck; pnpm test; pnpm build. With the production or dev server running on port 3001, node scripts/backend-smoke.mjs calls real place and VBB timetable APIs and verifies persisted status/results and non-bookability. Set SMOKE_URL for another port. This external smoke check depends on actual source availability. pnpm test remains deterministic and never sends supplier bookings or payment requests.

## Verified so far

Place lookup returned genuine GeoNames cities and VBB stops. VBB search returned six live timetable journeys, all explicitly unknown-priced and nonbookable. Development search results were written to ignored local files. Duffel search/reprice code follows official v2 endpoints but cannot be live-verified without a token. PostgreSQL/Supabase integration cannot be connectivity/transaction-verified until DATABASE_URL is provided. Stripe signature/timestamp/cookie/order invariants are tested locally; account connectivity and actual Checkout are not verified. Checkout is disabled regardless of key presence while supplier booking/settlement/compensation are unfinished. No actual charges, supplier bookings or tickets have been produced.

## Remaining work after access

Verify the chosen supplier's real sandbox offers and capabilities, including bags, transfer protections, expiry, holds and fulfillment. Coordinate additive passenger identity/contact/document contracts with frontend before booking implementation. Build idempotent supplier booking/settlement plus explicit failure/reconciliation and compensation handling before enabling customer Checkout. Full multimodal supplier coverage, cross-provider composition/protected transfers, account recovery and supported aftersales remain separate work. Regional timetables are not substitutes for commercial rail/coach/ferry supplier access.

Official references: https://docs.stripe.com/webhooks ; https://docs.stripe.com/api/checkout/sessions/create ; https://supabase.com/docs/guides/database/connecting-to-postgres ; https://node-postgres.com/features/ssl .
