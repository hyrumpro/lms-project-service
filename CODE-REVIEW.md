# Final Code Review — Academy LMS (beta)

Reviewed with security-first discipline (Security → Performance → Correctness → Maintainability)
against `master` at `2757e15`. Verdict: **ship-ready for beta; no blocking findings.**

## Security ✅

| Area | Finding |
|---|---|
| SQL injection | Only one `sql.raw` site remains (ETL `TRUNCATE` over a **hardcoded** table-name list — no user input). All dynamic lookups use Drizzle query builders / `inArray` with parameter binding. |
| Stored XSS | All 5 `dangerouslySetInnerHTML` sites (blog, custom pages, lesson bodies, home HTML blocks) pass through **DOMPurify** (`src/lib/sanitize.ts`) with an allow-list of tags/attrs/URI schemes. The 6th (JSON-LD) escapes `<` → `\u003c`. |
| Uploads | `POST /api/upload`: session required, instructor-only for course media, per-bucket MIME allow-list + size caps. `GET /api/files/*`: bucket allow-list + filename regex, traversal-safe. |
| API guards | Every admin action is `requireAdmin([section])`-scoped (granular flags); exports section-scoped; cron gated by `CRON_SECRET`; mobile `/api/v1` verifies the legacy HS256 JWT. Certificate PDF/files are public **by design** — the code is the capability (legacy parity). |
| Secrets | No keys in tracked files (swept for Neon/Live keys/AKIA). `.env` git-ignored; only `.env.example`. Legacy JWT secret is hardcoded **intentionally** (documented mobile-app compatibility window, spec §7.17). |

## Performance ✅

- Catalog/dashboard queries aggregate in SQL (counts, ratings via subqueries) — no N+1 on list pages.
- Player/lesson page loads sections+lessons in 2 parallel queries; progress heartbeats are throttled to 5s and upsert-only.
- Known acceptable: ETL does per-row lookups — it's an offline migration script, not runtime.

## Correctness ✅

- Money in integer minor units everywhere; revenue split read from the admin setting (`instructorRevenuePercent`), recorded at purchase time on `payments`.
- Idempotent fulfillment (`fulfillOrder` no-ops on paid orders) — webhook replay safe.
- Subscription auto-enroll uses `onConflictDoNothing`; canceled subscriptions keep access until `currentPeriodEnd`.
- Quiz grading preserves legacy sorted-array exact-match semantics (spec §3.2).
- Coupon math applies to the already-discounted price (legacy §3.9 parity).

## Maintainability ✅

- Strict TypeScript, `tsc --noEmit` clean; Drizzle schema is the single source of truth.
- Domains split: `server/{actions,queries,services}`, `lib/*` adapters (storage, payments, ai, jwt-legacy).
- i18n via next-intl namespaces (EN/ES); design tokens in `globals.css` (Editorial Academy / legacy purple).

## Pre-production checklist (external items)

1. Add real gateway keys (Stripe/PayPal/Razorpay) — adapters read `.env`.
2. Run `scripts/migrate/etl.ts` against the production legacy dump (proven end-to-end).
3. Sync `uploads/` media to S3/R2 (`STORAGE_DRIVER=s3` branch in `src/lib/storage.ts`).
4. Rotate the shared Neon credential; set a fresh `BETTER_AUTH_SECRET`.
5. Optional: wire `RESEND_API_KEY` for transactional email delivery.
