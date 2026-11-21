# Security evidence for the demo

Prepared for the owner's intended Aikido-sponsored cybersecurity-track entry. The organizer's detailed security rubric is not available here. These are measured controls and limitations, not a claim of production security certification or an Aikido scan.

| Risk / boundary                     | Control and evidence                                                                                                                                                                             | Limit                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Cross-customer order access         | Opaque HttpOnly guest cookie, hashed owner binding, same-origin checks; actual owner access 200, missing session 401 and foreign valid session 404                                               | No account recovery, login, cross-device identity or full account system                           |
| Cookie transport                    | HTTPS sessions use Secure, SameSite=Strict, Path=/api; configuration/regression checks pass                                                                                                      | Fresh hosted-browser return continuity requires its own observed walkthrough                       |
| Forged or repeated payment events   | Exact raw-body Stripe signature/timestamp validation, mapped Checkout/payment checks, transactional event deduplication; actual signed hosted delivery/replay 200, invalid signature 401         | Reliable delivery still depends on configured endpoint/monitoring                                  |
| Duplicate/uncertain travel purchase | Durable operation claims, stable payment idempotency and supplier reconciliation; actual replay retained one matching supplier order/payment                                                     | Ambiguous supplier creation/settlement is not automatically retried; manual review may be required |
| Payment/fulfillment confusion       | Capture requires active settled supplier booking and actual passenger-covered electronic-ticket references; cancelled/partial child guards are tested                                            | Not every cancellation/partial-failure scenario was externally exercised                           |
| Database privacy and transport      | Isolated private schema, RLS enabled, parameterized SQL and application ownership checks; actual transactions/rollback; both TLS legs verified after SSL enforcement with certificate validation | Server database role is privileged; RLS enablement alone is not proof of least-privilege isolation |
| Secret exposure to frontend/Git     | Server package boundary, ignored environment files and deployment upload exclusions; frontend import/storage boundary checks pass                                                                | Selected-pattern source scan is not exhaustive secret detection or history auditing                |
| Unintended live transactions        | Explicit development mode, matching supplier/Stripe test responses, live purchase rejection                                                                                                      | Live merchant/supplier activation and operational hardening remain separate work                   |

## Checks run

- `pnpm typecheck`, `pnpm test`, `pnpm build`: latest staged integration passed; 47 deterministic tests at this checkpoint.
- `pnpm audit --prod --audit-level high`: reported **No known vulnerabilities found** on 2026-11-21. This is a registry advisory snapshot, not proof that dependencies are vulnerability-free.
- Selected credential-pattern inspection of tracked text files found no candidates for Stripe keys, webhook secrets, Duffel tokens or private-key headers. It did not read or print ignored secret files and does not establish a complete historical secret audit.
- Actual service checks: PostgreSQL transactional writes/rollback and duplicate protection; client certificate authorization and both TLS legs; signed webhook delivery and duplicate replay; independently counted supplier order/payment and captured customer total.

## Remaining work

No Aikido platform scan, independent penetration test or formal compliance assessment has been performed. Abuse/rate limiting, monitoring/alerting, least-privilege deployment roles, account recovery, data retention and broader failure/aftersales operations require further work before live customer launch. Stripe test-mode success does not establish live payment or PCI compliance. Timetable data never grants a seat, payment or ticket.
