# Two laptops, one foundation

Both branches begin at the exact shared foundation commit. No divergent features are included in bootstrap.

| Branch        | Ownership                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| feat/frontend | apps/web/src/app except api; components; features; lib/api-client.ts      |
| feat/backend  | apps/web/src/app/api; packages/server; packages/contracts after bootstrap |

Coordinate dependency manifests, pnpm-lock.yaml and root configuration before editing. Only one laptop should change dependency versions at a time. Never resolve lockfile conflicts by hand: agree on manifests, regenerate with pinned pnpm, check and commit.

Frontend uses @wayward/contracts and the browser API client, never @wayward/server. Server entrypoint uses server-only to enforce that boundary.

## Exchange changes

Commit and push small changes to your own branch. Before integration, git fetch origin and git merge origin/main into your branch. For a contract update, backend sends the commit SHA and affected schemas to frontend; announce incompatible changes before adoption. Prefer additive optional fields or a new contract version. Frontend can git merge origin/feat/backend after fetching to adopt a coherent update; coordinate timing to avoid merging unfinished work. Avoid copying competing types or cherry-picking a commit twice.

Integrate tested branches into main through short PRs, then both laptops fetch and merge origin/main. Resolve conflicts together in the owning package; validate runtime schemas and consumers before pushing. No force-pushes or destructive resets. Keep credentials local and never conceal supplier access problems with fabricated success.

## First tasks

Frontend: extract search controls into features/search; implement provider-backed place selection using opaque IDs and per-passenger age/bag/discount editing, wired to the v1 API client. Preserve unavailable/error states.
Backend: confirm supplier sandbox access and official capabilities, then implement one real search adapter, place resolution and /api/search persistence/status without enabling payment or booking. Coordinate a place lookup contract/route with frontend first.
