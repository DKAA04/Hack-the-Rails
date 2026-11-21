# Wayward

**Go your own way.** A European multimodal travel workspace for flights, trains, coaches, ferries and local connections.

**[Hosted demo](https://wayward-nine.vercel.app)** · [Submission and walkthrough](docs/SUBMISSION.md) · [Deployed source SHA](https://wayward-nine.vercel.app/api/health/release)

The current release connects actual supplier flight search, repricing, unpaid holds, Stripe **test** payments, supplier **test** settlement and returned electronic-ticket references. Regional public-transit journeys are real timetables, separate from purchasable inventory. No live travel sales are enabled.

## Quickstart

Use Node.js 22.14+ and pnpm 10.32.1. Hosting runs Node 22.

```sh
git clone https://github.com/DKAA04/Hack-the-Rails.git Wayward
cd Wayward
npm install --global pnpm@10.32.1
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The app starts without credentials or a database and reports unavailable integrations explicitly. Results depend on real configured services; missing inventory is never fabricated.

For integrations, copy [.env.example](.env.example) to `apps/web/.env.local` only if that local file does not already exist. Set `WAYWARD_ENV=development` and `APP_URL=http://localhost:3000`, matching the actual port. Keep secret values local.

| Variable                             | Purpose                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | PostgreSQL / Supabase session-pooler SQL connection; required for orders/payments |
| `DUFFEL_ACCESS_TOKEN`                | Duffel test access for search, repricing and supported hold transactions          |
| `STRIPE_SECRET_KEY`                  | Matching Stripe test account                                                      |
| `STRIPE_WEBHOOK_SECRET`              | Signing secret for this exact local or hosted webhook destination                 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public Stripe test setting, if used by the client                                 |

Supabase public project settings do not replace SQL credentials. The isolated database adapter applies additive migrations only in `wayward_private`, enables RLS and validates Supabase TLS certificates/hostnames. Configured database failures never fall back to file-backed customer orders. Search-only development file storage is explicitly identified when PostgreSQL is absent.

For local signed delivery, use the same Stripe test account:

```sh
stripe listen --events checkout.session.completed,checkout.session.expired,payment_intent.amount_capturable_updated,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled --forward-to http://localhost:3000/api/webhooks/stripe
```

Save the listener secret privately in `apps/web/.env.local`, then restart. The deployed webhook has a different endpoint-specific secret. Full setup: [BACKEND_SETUP.md](docs/BACKEND_SETUP.md).

## Commands

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` serves the production build on port 3000. `pnpm test` is deterministic and performs no supplier purchases or payment requests. External transaction scripts have separate explicit execution guards; do not use them to recreate a confirmed or uncertain purchase.

## Architecture

One Next.js App Router app, two shared TypeScript packages and one pnpm lockfile. Next transpiles the source-exported packages. TypeScript is strict; Tailwind provides reusable design tokens.

| Boundary                 | Responsibility                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/web`               | React UI, resolved-place search, comparisons, trip workspace, checkout and guest orders; same-origin browser API calls |
| `apps/web/src/app/api`   | Thin handlers delegating to server services                                                                            |
| `packages/contracts`     | Canonical v1 Zod schemas/types; opaque supplier IDs, integer minor-unit money and explicit unknown values              |
| `packages/server`        | Provider adapters, normalization, orchestration, repricing, booking, payments and fulfillment                          |
| `packages/server/src/db` | PostgreSQL transactions, locks and private-schema persistence                                                          |
| External services        | Duffel test supplier, Stripe test payments, Supabase PostgreSQL and regional timetable/place sources                   |

Transaction path: actual offer → revalidate and accept total/conditions → durable order and traveller details → supported supplier hold → Stripe authorization → supplier settlement → actual fulfillment references → customer capture → confirmed order. Payment, settlement and fulfillment have separate states. Durable claims and reconciliation prevent automatic repetition of ambiguous supplier mutations. A real reference does not imply a downloadable PDF or known issuance timestamp.

Guest orders require their originating HttpOnly cookie. HTTPS cookies are Secure, SameSite=Strict and scoped to `/api`. Missing sessions receive 401; another valid guest session receives 404. An order ID alone does not grant access. Clearing the cookie loses guest access; account recovery is unfinished.

## Tested capabilities and limits

- Verified real supplier place lookup, flight test offers, normalization, repricing, persisted searches, draft orders and traveller updates.
- Verified a fresh local-browser Stripe test transaction, corroborated by one supplier order, one successful supplier payment, captured payment and an actual electronic-ticket reference. Hosted signed delivery and duplicate replay were verified separately. Fresh hosted-browser return evidence is tracked in [SUBMISSION.md](docs/SUBMISSION.md).
- Verified PostgreSQL commit, rollback, RLS, duplicate protection and protected order access. Both TLS legs passed after owner SSL enforcement, with client certificate validation enabled.
- Verified regional timetable journeys with unknown prices and no booking action. All transport modes remain in scope; commercial ground purchasing awaits partner access/implementation.
- Unavailable: live travel purchases/charges, instant-only flight purchasing, multi-supplier protected purchases, infant association, automated aftersales, account recovery and natural-language parsing. Comfort ranking uses transfer-related heuristics, not a verified seat-quality measurement.
- Coverage is regional, not Europe-wide commercial inventory. Open-Meteo's free geocoding adapter is development-only/non-commercial. Broader use needs appropriate supplier access and licensing.

The final integration includes Claude's `0e9c542` frontend revision and passes strict type checking, 49 deterministic tests and a production build. The release endpoint identifies the exact deployed SHA. [SERVICE_EVIDENCE.md](docs/SERVICE_EVIDENCE.md) and [DEPLOYMENT.md](docs/DEPLOYMENT.md) distinguish implementation, external evidence and gaps.

## Collaboration and API

Frontend owns `feat/frontend`; backend owns `feat/backend`; final integration uses `integration/final` and short PRs into `main`. Preserve local work and coordinate contracts, manifests and the lockfile. See [OWNERSHIP.md](docs/OWNERSHIP.md), [API_CONTRACT.md](docs/API_CONTRACT.md) and [TRANSACTION_INTEGRATION.md](docs/TRANSACTION_INTEGRATION.md).

The hosted app stays in development/test mode. `/api/health/release` identifies the deployed SHA; `/api/health/dependencies` probes PostgreSQL; `/api/capabilities` distinguishes key presence from verified provider access.
