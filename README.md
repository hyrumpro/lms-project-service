# Academy LMS — Next.js rebuild

Full-feature rebuild of **Academy LMS v7.1** (CodeIgniter/PHP) in Next.js.
The implementation blueprint is [`../NEXTJS-CLONE-BUILD-SPEC.md`](../NEXTJS-CLONE-BUILD-SPEC.md) —
feature specs, legacy file-review map, route map, and migration plan all live there.

> **ORM note:** the spec's §5 shows a Prisma schema as the data-map reference; per
> project decision we implement with **Drizzle ORM** (`src/db/schema/`). One pragmatic
> deviation: course pricing columns are inlined on `courses` instead of a separate table.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Drizzle ORM + PostgreSQL 16
- Better Auth 1.7 (email+password, OAuth-ready, rate-limited, session cookie cache)
- Tailwind v4 + shadcn/ui (base-nova style)
- Zod 4

## Quickstart

```bash
# 1. Start Postgres (host port 5433 — 5432 is used by another local project)
docker compose up -d

# 2. Configure env (already set up locally; .env.example is the template)
cp .env.example .env   # then set BETTER_AUTH_SECRET (openssl rand -base64 32)

# 3. Install & migrate
npm install
npm run db:migrate

# 4. Run (port 3100 — 3000 is used by another local project)
npm run dev
```

App: http://localhost:3100

> **Database:** currently pointed at the provided **Neon** test instance (see `.env`),
> migrated + seeded. The local Docker Postgres (`docker compose up -d`, host port 5433)
> remains available — switch by editing `DATABASE_URL`. The Neon credential was shared
> in chat; rotate it before any real use.

## Design system — "Editorial Academy"

Fraunces (display serif) + Geist body · warm paper background with SVG grain ·
ink primary · coral and highlighter-sun accents · kicker index labels (`01 · Catalog`)
· sticker-style price tags · notebook-style dashboard sidebar with dashed rules ·
dot-grid hero atmosphere. Tokens live in `src/app/globals.css`.

## Demo accounts (after `npm run db:seed`)

Password for all: `SuperSecret123!`
- `admin@academy-next.test` (admin)
- `sarah@ / miguel@ / elena@academy-next.test` (instructors)
- `john@ / maria@academy-next.test` (students)

## What's live

**Public (M1):**
- `/` home rendered from `home_page_configs` (editorial hero, categories, top courses, instructors)
- `/courses` — search, filters, 5 sort modes, pagination
- `/course/{slug}-{id}` — curriculum, instructors, reviews, FAQs, pricing card; free enrollment works; wishlist heart
- `/instructor/{id}`, `/blog` + `/blog/[slug]` (comments), `/p/[url]` custom pages
- `/sign-in`, `/sign-up`, `/forgot-password`; sitemap.xml, robots.txt, styled 404

**Learning experience (M3):**
- `/learn/[courseId]` → auto-resumes your last lesson
- `/learn/[courseId]/[lessonId]` — player shell: curriculum sidebar (completion ticks, drip locks), video lessons (native player with resume + auto-complete at 90%; YouTube/Vimeo embeds), text/audio/document lessons, quiz runner with legacy-parity grading + answer sheet
- Certificates auto-issued at 100% → public verify page `/certificate/{code}` (print/PDF styling)
- Demo: "Learning How to Learn" shows drip locks in action; john's Flutter enrollment is expired (shows the re-buy gate); try the free demo certificate at `/certificate/AC-DEMO1-TEST1`

**Commerce (M4):**
- `/dashboard/shopping-cart` — coupons, gifting, tax, gateway choice; **Sandbox Bank** mock gateway for full checkout demos (`/checkout/pay/[orderId]`)
- Stripe / PayPal / Razorpay adapters activate with API keys in `.env` + `gateway_configs` registry; offline bank-transfer orders await admin approval
- Printable invoices at `/dashboard/invoices/[orderId]`; revenue split (default 70/30, setting-driven) verified via `npx tsx scripts/test-purchase.ts`

**Instructor studio (M5):** `/studio` — course wizard, curriculum + quiz builder, sales, payouts, live classes, blog, AI assistant

**Admin (M6):** `/admin` — dashboard + manual enrollment, course moderation, users & instructor applications, commerce (orders/payouts/coupons), content & settings (home-page editor)

**Platform (M7/M8):** `/api/v1` mobile API with legacy JWT parity (`POST /api/v1/auth/login` → HS256 token), `/api/cron` (x-cron-secret), legacy URL redirects in `next.config.ts`, migration ETL in `scripts/migrate/`

**Student dashboard (M2):**
- `/dashboard` — greeting, stats, continue-learning
- `/dashboard/my-courses` — progress bars; `/dashboard/wishlist`; `/dashboard/purchases`
- `/dashboard/notifications` — unread states + mark-all-read (header bell shows count)
- `/dashboard/messages` + `/dashboard/messages/[threadCode]` — conversations + replies
- `/dashboard/profile` — editable profile

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on `:3100` |
| `npm run build` / `start` | Production build / serve on `:3100` |
| `npm run db:generate` | Generate SQL migration from `src/db/schema` |
| `npm run db:migrate` | Apply migrations to the DB |
| `npm run db:push` | Push schema directly (prototyping only) |
| `npm run db:studio` | Drizzle Studio |

## Structure

```
src/
  app/            routes (public pages, /api/auth/[...all] Better Auth handler)
  components/ui/  shadcn primitives
  db/
    schema/       auth.ts · catalog.ts · learning.ts · platform.ts (Drizzle)
    index.ts      postgres client + drizzle instance
  lib/auth.ts     Better Auth config (additionalFields: firstName, lastName,
                  role, isInstructor, status)
  lib/auth-client.ts
drizzle/          generated SQL migrations
```

## Auth smoke test (verified working)

```bash
curl -X POST http://localhost:3100/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","email":"student@academy-next.test","password":"SuperSecret123!","firstName":"Test","lastName":"Student"}'

curl -i -X POST http://localhost:3100/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"student@academy-next.test","password":"SuperSecret123!"}'
```

A seeded test account exists in the local DB:
`student@academy-next.test` / `SuperSecret123!`

## Legacy compatibility notes

- Legacy data migration (MySQL → Postgres), SHA-1 password bridge, and the
  legacy-slug redirect map are specified in the build spec §9 and come in milestone M8.
- Legacy mobile app JWT compatibility (`HS256`, legacy secret) is scheduled for M7 (§7.17).

## Legacy data migration (proven)

The full MySQL→Postgres ETL has been executed and validated against the real dump:

```bash
# 1. legacy MySQL (schema+data) — already available as container `academy-mysql`
docker start academy-mysql   # mysql://root:legacy@localhost:3307/academy_legacy

# 2. target Neon DB (fresh; schema via drizzle-kit push)
DATABASE_URL="…/academy_mig?sslmode=require" npx drizzle-kit push

# 3. migrate
LEGACY_DB_URL="mysql://root:legacy@localhost:3307/academy_legacy" \
DATABASE_URL="…/academy_mig?sslmode=require" npx tsx scripts/migrate/etl.ts --wipe
```

Verified transforms: money→minor units, unix timestamps, CSV multi-instructor/wishlist →
join tables, quiz answer indexes → strings, sha1 → `legacy-sha1:` login bridge, payments →
orders with preserved revenue split, completed lessons → progress rows. A validation report
prints at the end (row counts, orphans, warnings).

## Troubleshooting: 401 on sign-in

`POST /api/auth/sign-in/email → 401` means Better Auth rejected the credentials — the body will say `INVALID_EMAIL_OR_PASSWORD`. Checklist:

1. **Which DB is `.env` pointing at?** Credentials differ per database:
   - Demo DB (`…/neondb`): all seeded accounts use **`SuperSecret123!`**
   - Migrated DB (`…/academy_mig`): legacy users keep their **old legacy passwords** (SHA-1 bridge re-hashes on first login) — e.g. fixture users use `Secret123!`
2. Emails are lowercased — `John@…` works, but passwords are **case-sensitive**.
3. Run `npm run db:seed` if the DB was wiped/recreated — it prints every account + password.
4. Rate limiting is on (20 req/min/IP) — hammering the endpoint returns 429, wait a minute.
5. Account disabled in admin → also rejected.

Quick verify from CLI:
```bash
curl -i -X POST http://localhost:3100/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"john@academy-next.test","password":"SuperSecret123!"}'
```
200 = creds fine, the problem is elsewhere (e.g. wrong `DATABASE_URL` for the deployment).
