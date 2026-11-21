# Wayward

A European multimodal travel workspace: flights, rail, coaches, ferries and local connections. The backend branch now includes real place lookup and regional timetable search, a credential-gated Duffel flight search/reprice adapter, persisted results, and PostgreSQL draft-order/Stripe verification code. No inventory is fabricated. Customer checkout and supplier booking remain disabled.

## Setup

Node.js 22.14+ (Node 22.23.3 verified), pnpm 10.32.1.

```sh
npm install --global pnpm@10.32.1
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. No credentials or database required. Optional: copy .env.example to apps/web/.env.local. Keep values local. WAYWARD_ENV is development by default; set live only deliberately after operational safeguards exist. No integration is enabled merely by adding a key. APP_URL is reserved for trusted redirects; it is not used until checkout is implemented. Only NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY may reach the browser.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

One Next.js App Router app, two source-exported TypeScript packages, one lockfile. Next transpiles both packages; no separate package build is needed. Tailwind v4 theme tokens live in globals.css. All TypeScript projects use strict checking.

## Boundaries and status

- apps/web: responsive journey workspace, structured search inputs, all transport modes, comparison placeholders, trip cart and order/account empty state. The unconnected form never pretends to resolve supplier places or produce offers.
- packages/contracts: canonical Zod schemas and inferred v1 types.
- packages/server: thin route delegation, inspection, provider interfaces and explicit unfinished operations. PostgreSQL repository adapter is isolated in db; no fake memory orders.
- Customer Stripe checkout, supplier settlement and ticket fulfillment are distinct services. No real charges, bookings, registrations or funding are performed.

Backend increments are documented in docs/BACKEND_SETUP.md and docs/API_CONTRACT.md. GET /api/places provides resolved places; /api/search persists real supplier/timetable outcomes; GET /api/health/dependencies checks PostgreSQL reachability. Frontend must render timetable journeys as unknown-priced and nonbookable.

The following bootstrap notes describe the initial foundation; consult those backend documents for current route behavior. Health checks process/configuration only. Capability inspection distinguishes key presence from verified connectivity. Duffel and All Aboard credentials are recognized but adapters are unimplemented. Distribusion and Omio partner access/authentication and all operation coverage remain unresolved. Public transit sources require region/licensing decisions. DB_CLIENT_ID/DB_API_KEY and SNCF_API_TOKEN are reserved research settings, not assumed supplier access. OPENAI_API_KEY is reserved for natural-language parsing, which is not implemented. Stripe has no active charging path. PostgreSQL is not connected. Actual customer identity and authorized order lookup are not implemented.

See docs/API_CONTRACT.md and docs/OWNERSHIP.md for safe integration requirements and two-laptop workflow. Official framework references: https://nextjs.org/docs/app/getting-started/installation and https://tailwindcss.com/docs/installation/framework-guides/nextjs.

## Two laptops

Frontend laptop:

```sh
git clone https://github.com/DKAA04/Hack-the-Rails.git Wayward
cd Wayward
git switch feat/frontend
npm install --global pnpm@10.32.1
pnpm install --frozen-lockfile
pnpm dev
```

Backend laptop uses the same commands with `git switch feat/backend`. Existing clones should commit their own work, then `git fetch origin` and switch to the relevant tracking branch. SSH clone works after configuring your own GitHub SSH key; the bootstrap machine used HTTPS because SSH authentication was unavailable.

## Foundation verification

Verified on Node 22.23.3: pinned workspace install and frozen-lockfile reinstall; strict type checks for every package; three contract invariant tests; production build; production server startup without external credentials; home and health HTTP 200; capability inspection reports no enabled supplier operations; every valid business POST returns typed 501; invalid search returns 400; search/order retrieval returns 501; unsigned/unconfigured Stripe webhook fails closed. No external supplier or payment requests were sent.

With the server running, `pnpm test:smoke` repeats the HTTP checks. It uses structurally valid opaque test identifiers solely to verify rejection, never creates inventory or customer orders. PostgreSQL, real supplier connectivity, authentication, natural-language parsing, payments and fulfillment remain unimplemented and are the next development work.
