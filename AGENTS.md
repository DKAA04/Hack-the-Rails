# Wayward collaboration

Read docs/OWNERSHIP.md and docs/API_CONTRACT.md before changes.
Frontend feat/frontend owns pages, layout, CSS, components, feature UI and apps/web/src/lib/api-client.ts. Backend feat/backend owns API routes and packages/server; backend maintains packages/contracts after bootstrap.
Coordinate changes to manifests, lockfile and root configuration. Import shared v1 contracts; frontend must never import server code or secrets. Keep unknown values unknown. Credentials do not prove connectivity; timetables do not prove seats or tickets. Never fabricate inventory, bookings, charges or fulfillment.
Use small commits and frequent integration. No force pushes, destructive resets or overwriting another laptop's work. Run pnpm typecheck, pnpm test and pnpm build before integration. Report supplier access and unfinished operations honestly.
