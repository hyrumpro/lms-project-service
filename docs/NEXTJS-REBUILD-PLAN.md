# Academy LMS v7.1 → Next.js Rebuild Plan

> Deep analysis of the legacy CodeIgniter application + a phased, detailed plan to rebuild it as a modern Next.js application.

---

## Part A — What the legacy app actually is

### A1. Identity & stack

| | |
|---|---|
| Product | **Academy LMS v7.1** (Creativeitem, CodeCanyon script) |
| Backend | PHP 5.3+ / **CodeIgniter 3** (MVC, server-rendered) |
| Database | MySQL (46 tables, schema in `uploads/install.sql`) |
| Frontend | jQuery + Bootstrap views in `application/views/frontend/default-new` (single theme) |
| Mobile | Ionic-style mobile app talking to **JWT REST APIs** (`Api.php` for students, `Api_instructor.php` for instructors) + server-rendered "mobile web views" for payment/quiz/live-class webviews |
| Auth | Session-based (CI sessions in DB `ci_sessions`), custom password hashing, Facebook/Google/LinkedIn/Twitter social login, email verification |
| i18n | Phrase table (`language`) + 16 JSON dictionaries in `languages/*.json` (incl. RTL: Arabic, Urdu) |
| Size | ~13.5k lines in controllers alone; `Crud_model.php` alone is **5,570 lines** (a god-model doing all queries) |

### A2. Architecture map

```
application/
  controllers/        Admin (4,449 ln) · Home (2,268) · User (1,560, instructor) ·
                      Payment (851) · Api (881, student mobile) · Api_instructor (523) ·
                      Api_files · Login · Sign_up · Blog · Data_center (DB export) ·
                      Files · Page · Sitemap · Updater · Install · Modal · View · Checker (dead)
  models/             Crud_model (god model) · User_model · Payment_model · Email_model ·
                      Video_model · Jwt_model · Academy_cloud_model · Addon_model · ...
  views/              frontend/default-new (~100 pages) · backend/admin (~170 pages) ·
                      backend/user (~70 instructor pages) · lessons/ (player) · mobile/ · email/
uploads/              media + install.sql
update/update_7.1/    delta patch for v7.1
languages/            16 JSON dictionaries
```

**Routing** is CodeIgniter convention (`controller/method/param`) plus custom routes for blogs, custom pages, and (missing) addons. There is no API for the web frontend — it's all server-rendered.

### A3. Database schema — 46 tables grouped by domain

**Identity & access**
- `users` — names, email, password, skills, biography, social links (JSON), `role_id`, `is_instructor`, `wishlist` (comma-separated IDs!), `payment_keys` (gateway keys per instructor), `verification_code`, `status`, `image`, `sessions`
- `role` · `permissions` (per-admin JSON of toggles) · `ci_sessions`

**Catalog**
- `course` — the big one: title, descriptions, `outcomes`/`requirements`/`faqs`/`section` (JSON blobs), pricing (`price`, `discount_flag`, `discounted_price`, `is_free_course`), `language`, `category_id`/`sub_category_id`, `level`, `user_id` (**comma-separated instructor IDs = multi-instructor**), `multi_instructor` flag, `course_type` (general/scorm), `status` (draft/pending/active), `is_top_course`, meta SEO fields, `expiry_period` (access expiry), `enable_drip_content`, `publish_date`
- `category` — self-referencing (parent = category, child = sub-category), slugs, thumbnails, font-awesome icons
- `section` — course sections w/ `restricted_by` (drip rule) and ordering
- `lesson` — `lesson_type` (video/audio/document/text), `video_type` (html5/youtube/vimeo/iframe/external/wasabi/google_drive/academy_cloud), URLs, attachment + type, captions, summary, `is_free` (preview), ordering, `quiz_attempt` (max attempts), separate mobile-app fields
- `question` — quiz questions: `type` (multiple_choice / single_choice+true-false / fill_in_the_blank), `options` (JSON), `correct_answers` (JSON), ordering
- `resource_files` — downloadable course attachments

**Sales & money**
- `payment` — one row per enrollment: amount, `payment_type` (gateway), `admin_revenue`, `instructor_revenue`, `tax`, `transaction_id`, `session_id`, `coupon`, `instructor_payment_status`
- `payment_gateways` — plugin-style registry: `identifier`, `keys` (JSON), test-mode flag (PayPal, Stripe, Razorpay, PayU, SSLCOMMERZ, Xendit, Doku, Pagseguro, Skrill, offline…)
- `currency` — code/symbol + which gateways support it
- `coupons` — code, `discount_percentage`, expiry
- `payout` — instructor withdrawal requests + status
- `enrol` — the enrollment join: user/course, `gifted_by` (gifting), `expiry_date`, dates

**Learning analytics**
- `watch_histories` — per student+course: `completed_lesson` (JSON array of lesson IDs!), `course_progress`, `watching_lesson_id`, `quiz_result`
- `watched_duration` — per student+lesson: `current_duration` (resume position), `watched_counter` (plays)
- `rating` — polymorphic (`ratable_type`/`ratable_id`), review text
- `comment` — polymorphic, used on lessons/lesson questions (Q&A)
- `tag` — polymorphic tags

**Community / content**
- `blogs` + `blog_category` + `blog_comments` (threaded) — visibility, popular flag, admin-approval for instructors
- `message_thread` + `message` — 1:1 DMs
- `notifications` + `notification_settings` — per event: system/email toggles, editable subject/template
- `newsletters` + `newsletter_subscriber` + `newsletter_histories` — campaigns
- `contact` — contact form inbox w/ replied flag
- `instructor_followings` · `badges` (gamification, condition_from/to) · `applications` (instructor applications)

**CMS / platform**
- `home_pages` — the drag-&-drop home page builder (multiple templates: default, university, fitness, marketplace, kindergarten, cooking, language-academy, development, elegant)
- `frontend_settings` (key/value) · `settings` (key/value — ~80 keys: SMTP, storage, SEO, socials, taxes, watermarks, device-limit, etc.)
- `custom_fields` — extra sections/fields rendered on course pages (sortable)
- `custom_page` · `seo_fields` (per-route meta + OG + JSON-LD) · `addons` · `language` · `log` · `bbb_meetings` (BigBlueButton live classes)

### A4. Complete feature inventory

**Public / student (web)**
- Home w/ page-builder layouts (9 template skins), hero, top-category/course/instructor sections, testimonials, FAQ, promotional & motivational sections
- Course catalog: grid/list layouts, sorting, sidebar filters (category, sub-category, level, language, price, rating), search
- Course detail: video preview, curriculum accordion (preview lessons `is_free`), instructor bio card, reviews w/ ratings, custom fields, FAQs, requirements/outcomes, related courses
- Cart & checkout: cart, wishlist, buy-now, coupons, gifting, course compare (3-way), free enrollment
- Learning: `lessons` player — HTML5 (plyr), YouTube, Vimeo, iframe, external URL, Amazon S3/Wasabi/Google Drive/"Academy Cloud" (vendor-hosted) video; audio; PDF/document viewer; text lessons; quizzes; sidebar w/ progress; resume playback; drip content; course expiry enforcement
- Quizzes: single choice (incl. true/false), multiple choice, fill-in-the-blank; graded by exact sorted-answer match; results saved w/ attempts; result page + answer sheet
- Progress: completed lessons (manual "mark complete" + video-watch tracking), % progress, quiz results; resume where you left off
- Purchase history + printable invoices; my certificates (addon, `certificate/(:any)` route); badges page; following instructors; messages; notifications
- Blog (list, categories, details, comments, likes); custom pages; contact form; cookie consent; policy pages (terms/refund/privacy); course compare; instructor public pages w/ follow; 16 languages w/ RTL; per-route SEO + sitemap.xml
- Login/signup w/ email verification, forgot password, social logins, account-disable state

**Instructor (User.php + backend/user views)**
- Apply to become instructor (applications table w/ document upload, admin approval)
- Course studio: create/edit courses (multi-step: basic info → media → pricing → requirements/outcomes → certification?) — actually outcomes/requirements are sub-forms
- Curriculum builder: sections & lessons with drag-and-drop sorting (dragula), 10 lesson types, quiz builder w/ per-type question forms, question sorting
- Multi-instructor authoring (comma-separated owners; admins can change course author)
- Sales report (server-side processed table), payout report, withdrawal requests, payout settings (PayPal/stripe keys per instructor stored on user row)
- Instructor blog authoring (goes to admin moderation)
- Custom-field management for their own courses

**Admin (Admin.php, ~140 methods)**
- Dashboard w/ charts; management CRUDs: categories, sub-categories, instructors, students, admins w/ granular permissions page, manual enrollment (+CSV export of history), shortcuts
- Course moderation: pending/active/denied queues, change status, duplicate course, change author, watch video, reviews moderation (add/edit/delete)
- Revenue: admin revenue, instructor revenue, purchase history, invoices, instructor payout w/ **PayPal/Stripe/Razorpay checkout for paying instructors**
- Payments settings: gateway registry w/ keys & test mode, currency setup, tax
- Settings: system (name, logo, favicon, timezone, language dirs, device login limit, watermarks), frontend (theme, banner, sections toggles, footer, custom CSS/JS embed, Google Analytics, Meta Pixel), instructor settings (allow instructor, revenue %, application note), email templates editor, notification settings, social login, SEO settings + sitemap settings, theme settings, OpenAI settings
- Home page builder (drag & drop, image uploads, preview, layout switch, 9 template skins)
- Blog management + categories; newsletter campaigns (create/send/statistics/subscribers); custom pages; custom fields designer; badges; coupons; contact inbox; resource files; Academy Cloud (vendor video storage) browser; **Data center** (DB backup/export); cronjob config; language manager (edit phrases inline w/ AJAX, import/export, RTL direction)
- AI: OpenAI settings, ChatGPT modal, GPT assistant, AI image generation download
- Live classes: BigBlueButton settings + meeting creation/start (Zoom/Jitsi exist as addons)

**Mobile APIs**
- `Api.php` (student): login/signup/verify, categories, top/filtered/searched courses, course object + sections + lessons, wishlist/cart toggles, free enrollment, quiz submit, progress update, profile update, bundles, **forum (Q&A)** endpoints, JWT issuance (`Jwt_model`)
- `Api_instructor.php`: full instructor studio API (courses, sections, lessons, sorting, pricing, sales/payouts, live classes)
- `Api_files.php`: file serving for the app

### A5. Quirks, dead weight & gaps found (important for a faithful rebuild)

1. **`Checker.php` is dead code** — its class is `Mobile` and it belongs to *Ekattor School Management* (another Creativeitem product: classes, parents, attendance, exam marks). It isn't part of Academy LMS. Skip entirely.
2. **Addons are missing from this copy.** Routes + code reference: certificate, course bundles, ebook/ebook manager, tutor booking, SCORM, H5P, live classes (Zoom/Jitsi), offline payment, affiliate, bootcamp, team training, customer support, AI. `application/controllers/addons`, `models/addons` and `themes/` are empty. Decision needed: rebuild which addon features as native modules (recommended: certificates, offline payments, live classes, Q&A forum) and drop the rest.
3. **Multi-instructor** is stored as *comma-separated user IDs* in `course.user_id` — must become a proper join table.
4. **Wishlist** is stored comma-separated on the user row — becomes a join table.
5. **Completed lessons** stored as JSON array in `watch_histories.completed_lesson` — becomes a `lesson_progress` table.
6. Quiz grading is naive: `sort(correct) == sort(submitted)` — a rebuild is a chance to add per-question partial scoring, but keep behavior parity in v1 for migration compatibility.
7. Settings are scattered key/value strings incl. JSON blobs (`drip_content_settings`, `stripe_keys`) — needs typed schema.
8. "Academy Cloud" is vendor lock-in (video.creativeitem.com upload API) — replace with own object storage/streaming.
9. Security debt everywhere worth fixing in rewrite: MD5-ish legacy hashing (check `User_model`), no CSRF on several AJAX endpoints, file-upload handling, raw `$_FILES` usage, SQL via query builder (fine) but echo'd JSON without headers, etc.

---

## Part B — The Next.js rebuild

### B1. Goals & principles

1. **Parity first, delight second** — every legacy user journey works before we add new things.
2. **One codebase** — web app + REST API (`/api/v1`) so a future mobile app can reuse it (replaces `Api.php` + `Api_instructor.php`).
3. **Typed end-to-end** — Prisma schema is the single source of truth; Zod validation at every boundary.
4. **Modernize the storage of data, preserve the meaning of features** (join tables instead of comma-strings, typed settings, webhook-driven payments).
5. **Ship in phases with a real DB migration** from the existing MySQL data.

### B2. Recommended stack (with rationale)

| Concern | Choice | Why / alternative |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Server Components cut the client JS the legacy jQuery app needed; RSC + Server Actions remove most CRUD API boilerplate |
| UI | **Tailwind CSS + shadcn/ui** | Fast parity with the Bootstrap-era look, full control, accessible primitives |
| DB | **PostgreSQL (Neon or Supabase)** + **Prisma** | JSON columns for legacy blobs, FTS for search, mature with Next.js. *Alternative: keep MySQL — Prisma supports it; pick MySQL if data-migration friction is a top worry* |
| Auth | **Better Auth** | Credentials + OAuth (Google/Facebook/LinkedIn) + email verification + sessions/impersonation + RBAC plugin; battle-tested. *Alternative: Auth.js v5* |
| Payments | **Stripe Checkout + webhooks**, **PayPal v2 (Subscriptions/Orders)**, **Razorpay**; plugin registry table for regional gateways (PayU, SSLCOMMERZ, Xendit, Doku, Pagseguro, Skrill, offline transfer) | Webhook-driven state machine replaces the legacy "return-URL trust" model |
| Video | Object storage (**S3 or Cloudflare R2**) for MP4s + **Cloudflare Stream** or **Mux** for HLS delivery + signed URLs; keep native **YouTube/Vimeo/iframe** lesson types | Replaces Academy Cloud vendor lock-in; resume tracking via player events |
| File uploads | S3/R2 via presigned URLs (`@aws-sdk/client-s3`), images via `next/image` + optimizer route | |
| Email | **React Email** templates + **Resend** (or SMTP fallback — legacy settings kept) | |
| i18n | **next-intl**; seed the 16 dictionaries directly from `languages/*.json` | RTL support built-in |
| State/data-fetch | Server Components first; **TanStack Query** for the player/dashboard client islands | |
| Validation | **Zod** (shared schemas client+server) | |
| Background jobs | **Inngest** or **QStash** (webhooks, emails, newsletter fan-out, cron: expiries, drip unlocks) | Replaces legacy `cronjob` settings |
| Search | Postgres full-text (v1) → **Meilisearch** (v2, typo-tolerance + filters) | |
| PDF (certificates/invoices) | `@react-pdf/renderer` (certificates, invoices) | |
| Testing | Vitest + Testing Library; Playwright E2E on critical flows (enroll → learn → quiz → certificate) | |
| Hosting | Vercel (app) + Neon (DB) + R2 (assets) or single VPS w/ Docker | |

### B3. Target architecture

```
src/
  app/
    (public)/              home, courses, course/[slug], instructor/[slug], blog, pages, search
    (auth)/                sign-in, sign-up, verify, forgot-password
    (learn)/               learn/[courseId]/[lessonId]   ← the player (auth-gated, App Shell)
    dashboard/             student: my-courses, wishlist, purchases, messages, notifications, certificates
    studio/                instructor: courses, curriculum, quizzes, sales, payouts, blog
    admin/                 dashboard, moderation, users, settings, builder, newsletters, ...
    api/v1/                REST surface for mobile (mirror of legacy Api.php / Api_instructor.php)
    api/webhooks/          stripe, paypal, razorpay
    sitemap.ts, robots.ts, [SEO redirects]
  components/              ui/ (shadcn), course/, player/, admin/, forms/
  lib/                     auth (RBAC), db (prisma), payments/, storage/, email/, i18n, seo, jobs
  server/                  actions/ (server actions by domain), queries/ (RSC data loaders), services/ (domain logic)
  prisma/                  schema.prisma + seed (from legacy MySQL)
```

**RBAC model:** `User.role` ∈ {student, instructor, admin} + `AdminPermission[]` granular flags (parity with legacy `permissions` table). Guarded at 3 layers: middleware (route groups), per-action service checks, and UI gating.

**Payments state machine:** `Order` (cart snapshot) → `checkout session` → webhook events → `Payment` + `Enrollment` (idempotent). Replaces legacy `payment` row written on return-URL. Offline payment = order status `pending_review` + admin approval UI (parity with offline addon).

**Learning progress:** `LessonProgress` (per lesson, completed + secondsWatched + lastPosition) → aggregated `CourseProgress` view; video player posts heartbeat events (throttled) like legacy `update_watch_history_with_duration`.

**Drip content:** section `unlockRule` (date / previous-section-complete / days-from-enrollment) evaluated in the player + cron job.

### B4. Data model mapping (legacy → Prisma)

Legacy (46 tables) → New (~34 models). Key transformations:

| Legacy | New | Change |
|---|---|---|
| `users` | `User` + `Profile` fields inline | password → Better Auth `Account`; `wishlist` string → `WishlistItem[]`; `payment_keys` → `PayoutAccount` |
| `role`, `permissions` | enum `Role` + `AdminPermission` | typed |
| `category` (self-ref) | `Category` (self-relation, `kind: category|subcategory`) | same idea, cleaner API |
| `course` | `Course` + `CourseInstructor` join | comma-IDs → join; JSON blobs (outcomes/requirements/faqs) → `Json` columns w/ Zod; SEO fields → `SeoMeta` |
| `section` | `Section` + `unlockRule Json` | drip rules typed |
| `lesson` | `Lesson` (discriminated union by `type: video|audio|document|text|quiz` + `videoProvider` enum incl. `youtube/vimeo/html5/iframe/s3/stream/embed`) | mobile-only duplicate fields dropped (same API serves both) |
| `question` | `Question` (types: single/multiple/fill-blank; options+answers JSON) | keep parity; extensible |
| `enrol` | `Enrollment` | + `giftedBy`, `expiresAt`, `source: purchase|gift|free|manual|bundle` |
| `payment` | `Order` + `Payment` + `RevenueShare` | splits gross/tax/admin/instructor; instructor payout status on `Payout` ledger |
| `payment_gateways` | `PaymentGatewayConfig` | keys encrypted at rest (AES-GCM) |
| `payout` | `Payout` (ledger) + `PayoutMethod` | |
| `watch_histories` | `CourseProgress` (materialized from `LessonProgress`) | JSON completed list → table |
| `watched_duration` | `LessonProgress` | |
| `rating`, `comment`, `tag` | `Review`, `Comment` (polymorphic via `targetType/targetId`), `Tag` | |
| `message_thread`, `message` | `MessageThread`, `Message` | |
| `notifications`, `notification_settings` | `Notification` + `NotificationTemplate` (system/email toggles per event) | |
| `newsletters`*3 | `Newsletter`, `Subscriber`, `Campaign` | fan-out via jobs |
| `blogs`*3 | `Post`, `PostCategory`, `PostComment` | instructor posts default `pending` |
| `home_pages` | `HomePageConfig` (ordered section JSON) | v1: curated section types, not free-form HTML |
| `frontend_settings`, `settings` | `Settings` (typed per-domain: `SystemSettings`, `PaymentSettings`, `SeoSettings`, …) | Zod-validated JSON blobs |
| `custom_fields`, `custom_page`, `seo_fields` | `CustomField`, `CustomPage`, `SeoMeta` | |
| `coupons`, `currency`, `badges`, `applications`, `instructor_followings`, `resource_files`, `contact` | direct ports | |
| `bbb_meetings` | `LiveClass` (provider: zoom/jitsi/bbb) | generalized |
| `ci_sessions`, `log`, `addons`, `language` | dropped | auth lib sessions; structured logging (`pino`); i18n via next-intl files |

### B5. Route map (legacy → Next) for SEO redirects

| Legacy URL | New route |
|---|---|
| `/` (home builder) | `/` |
| `home/courses` | `/courses` (+ `/courses?category=…&sort=…&layout=…`) |
| `home/course/{slug}/{id}` | `/course/{slug}-{id}` → 301 from old |
| `home/lesson/{slug}/{courseId}/{lessonId}` | `/learn/{courseId}/{lessonId}` (auth) |
| `home/my_courses` / `my_wishlist` / `purchase_history` | `/dashboard/...` |
| `user/...` (instructor) | `/studio/...` |
| `admin/...` | `/admin/...` |
| `home/instructor_page/{id}` | `/instructor/{slug}` |
| `blogs` / `blogs/{slug}` | `/blog`, `/blog/{slug}` |
| `page/{url}` | `/p/{url}` |
| `certificate/{code}` | `/certificate/{code}` (public verify + PDF) |
| `sitemap.xml` | `sitemap.ts` |

`redirects()` in `next.config.ts` generated from the DB at build/cron time.

### B6. Feature-by-feature build guide (with legacy reference)

**1. Auth & onboarding** (`Login.php`, `Sign_up.php`, `User_model`)
Credentials + Google/Facebook/LinkedIn OAuth (Better Auth), email verification flow (token link, not legacy 6-digit), forgot/reset, "account disabled" state, device/session limit (policy hook on session create). Student ↔ instructor application: `Application` model + admin approve → grants `instructor` role (parity with `applications` + `allow_instructor` setting).

**2. Catalog & public pages** (`Home.php`)
Home page renders ordered sections from `HomePageConfig` (hero, top-categories, top-courses, top-instructors, testimonials, FAQ, banner, promotional, motivational, custom HTML) — admin-editable, previewable. Catalog with server-side filtering/pagination (URL state), grid/list toggle (query param), sorting. Course page: RSC composition of preview video, curriculum (accordion, free-preview badge), reviews, instructor card, custom fields, FAQs, JSON-LD `Course`/`Product` schema, OG from `SeoMeta`. Instructor public page w/ follow button (Server Action). Blog, custom pages, contact form (job → email + inbox), cookie consent, policies.

**3. Cart, checkout, payments** (`Home::shopping_cart/payment`, `Payment_model`)
Cart (session-local → merged on login), wishlist, buy-now, coupons (server-validated), gifting, tax setting. Checkout: Stripe Checkout & PayPal Orders + webhooks; Razorpay for India; regional gateways behind a `GatewayAdapter` interface (`createSession`, `verifyWebhook`, `refund`); offline transfer = bank instructions + admin approval. On payment: idempotent `Enrollment` creation, revenue split (admin/instructor % from `instructor_revenue` setting), notifications, invoice PDF. Free courses: direct enrollment. Course expiry enforced in player middleware + cron.

**4. The player** (`views/lessons/*`, `Checker`-less web quiz flow)
App shell: sidebar (sections/lessons + progress ticks), top bar, content pane per lesson type. Player components: plyr-equivalent (**Vidstack**) for MP4/HLS with resume + heartbeat progress; YouTube/Vimeo iframes w/ postMessage progress; PDF viewer (react-pdf) w/ watermark option; audio player; text/HTML lesson; quiz runner. Quiz engine: take quiz (attempts from `quiz_attempt`), server-side grading (parity: exact match of sorted option IDs for v1), `QuizResult` persistence, result screen w/ answer sheet, completion hooks into progress + drip unlocks. Mark-complete + auto-complete-on-watch. Notes/Q&A per lesson (legacy `comment` polymorphic) optional v2.

**5. Instructor studio** (`User.php`, `views/backend/user/*`)
Course wizard (info → curriculum → media → pricing → requirements/outcomes → publish → moderation queue), curriculum builder with **@dnd-kit** drag-sort (sections, lessons, questions), 10 lesson-type forms (video upload via presigned S3 + provider pick; YouTube/Vimeo/iframe/external; audio; document; text w/ rich editor **Tiptap**), quiz builder, pricing (discount flag, free flag), course dashboard (server-side table like `courses-server-side.php`), sales report, payout report + withdrawal request, payout methods, instructor blog (pending moderation).

**6. Admin** (`Admin.php`)
Dashboard (charts via Recharts), moderation queues (pending courses w/ preview, status transitions + "mail on status change" notification hooks), user/instructor/admin management (+granular admin permissions), manual enrollment + history + CSV export, revenue views + invoices, instructor payouts (manual mark-paid v1; PayPal Payouts API v2), reviews moderation, categories, coupons, badges, contact inbox, resource files, custom fields designer (sortable sections), custom pages, blog mgmt, newsletter campaigns (compose → job fan-out → stats), settings hub (system/frontend/payment/notification/email templates/social login/SEO/sitemap/language/OpenAI), language manager (edit phrases inline, import/export JSON, RTL toggle), Data-center replacement: DB backups via provider tooling.

**7. Live classes, certificates, forum (addon parity)**
`LiveClass` (Zoom Server-to-Server OAuth create/join; Jitsi iframe embed; BBB adapter optional) + schedule on course page + mobile webview route. Certificates: template editor (logo/name/course/signature), `@react-pdf/renderer` PDF + public verify page `/certificate/{code}`. Q&A forum (legacy addon): polymorphic `Comment` threads at course level w/ votes.

**8. AI features** (`open_ai_settings`, `chat_gpt`, `gpt_assistant`, `ai_img_download`)
OpenAI settings page; GPT assistant for instructors (course description/outcome drafting), AI image gen for thumbnails. Isolated in `lib/ai` so the provider can be swapped.

**9. Mobile API** (`Api.php`, `Api_instructor.php`)
`/api/v1` REST w/ JWT (Better Auth bearer or jose-issued), versioned, documented with OpenAPI (`zod-openapi`): student endpoints (catalog, course object, sections/lessons, enroll, progress, quiz submit, wishlist, profile) and instructor endpoints (course CRUD, curriculum, sales, payouts). The legacy app's webviews (payment/quiz/live) become regular authenticated web routes that open in the app webview.

**10. Notifications, email, i18n, SEO**
Notification templates seeded from legacy `notification_settings` (course purchase, status change, withdrawal, gift, certificate, newsletter...), in-app bell + email via React Email. i18n: next-intl, seeded dictionaries from `languages/*.json`, RTL routing for ar/ur. SEO: metadata API per page, JSON-LD, `sitemap.ts` (courses/blogs/pages), OG image generation (`opengraph-image`), legacy-slug 301 map.

### B7. Phased roadmap

| Phase | Scope (deliverable = demoable) | Est. |
|---|---|---|
| **0 — Foundation** | Scaffold (TS, ESLint, Tailwind, shadcn), CI, Prisma schema v1, Better Auth (credentials+OAuth+RBAC), settings service, deployment pipeline, design tokens | 1–2 wk |
| **1 — Catalog & public site** | Home sections, courses list/filter/sort, course detail, instructor pages, blog, custom pages, contact, i18n seed, SEO/sitemap/redirects | 2–3 wk |
| **2 — Auth-complete + student shell** | Verification, forgot/reset, account disable, dashboard shell: my courses, wishlist, purchases, notifications, messages | 1–2 wk |
| **3 — Learning experience** | Player (all lesson types), progress engine, resume, drip rules, quiz engine + results, certificates | 3 wk |
| **4 — Payments** | Cart/checkout, Stripe+PayPal+Razorpay+webhooks, coupons, gifting, tax, invoices, enrollment ledger, offline-payment approval, revenue split | 2–3 wk |
| **5 — Instructor studio** | Course wizard, curriculum builder (dnd), quiz builder, media/pricing, sales & payout reports, withdrawal requests, instructor blog | 3 wk |
| **6 — Admin suite** | Moderation, users/permissions, enrollments+CSV, revenue/payouts, reviews, settings hub, newsletters, language manager, custom fields/pages, home-page builder v1 | 3–4 wk |
| **7 — Platform hardening** | Mobile `/api/v1`, live classes (Zoom/Jitsi), AI assistant, cron jobs (expiry/drip/newsletter), backups, observability, Playwright E2E suite | 2–3 wk |
| **8 — Migration & cutover** | MySQL→Postgres ETL scripts (users w/ rehash-on-first-login, courses, sections, lessons, enrollments, payments, progress), staging rehearsal, 301 map, launch | 1–2 wk |

Rough total: **18–24 weeks** solo full-time-equivalent; phases 1–4 alone give a sellable MVP (~10–12 wk).

### B8. Data migration strategy (legacy MySQL → new Postgres)

1. Read-only `mysql2` ETL scripts (`scripts/migrate/*`) mapping per Part B4; run against a copy of the live DB.
2. Users: verify legacy hash scheme in `User_model`; store legacy hash in a `legacyPassword` column → transparent re-hash (bcrypt/argon2) on first successful login; force-reset if unverifiable.
3. Media: sync `uploads/` (thumbnails, lesson files, blog images, user images) to S3/R2 preserving paths; rewrite DB URLs.
4. Content JSONs (outcomes/requirements/faqs/options/correct_answers/custom fields/drip settings/home pages) parsed + validated with Zod; failures quarantined to a report, not dropped.
5. `payment` rows → `Payment` + `RevenueShare` (derive admin/instructor split using recorded amounts; fallback to current instructor-revenue %).
6. Progress: explode `completed_lesson` JSON → `LessonProgress` rows; recompute `CourseProgress`.
7. Slugs preserved + `redirects` table generated for every legacy URL pattern; rehearsal on staging with diff report (row counts + spot-checks); freeze legacy during final cutover.

### B9. Open decisions (recommendations included)

1. **DB engine** — Postgres (recommended) vs MySQL. Postgres unlocks FTS/JSON power; MySQL lowers migration friction slightly.
2. **Video delivery** — Cloudflare Stream (simple, cheap, signed HLS, recommended) vs Mux (best analytics/DRM, pricier) vs self-host S3+CloudFront.
3. **Which addon features are native in v1** — recommended: certificates, offline payment, live classes, Q&A. Drop/defer: SCORM, H5P, ebook, bundles, tutor booking, affiliate, bootcamp, team training.
4. **Page builder fidelity** — curated section types v1 (recommended) vs free drag-drop canvas (large effort; legacy had a DOM-path-based builder).
5. **Keep the legacy Ionic app?** — if yes, we must keep the legacy JWT response shapes for one release cycle (adapter layer) before the app migrates to `/api/v1`.
6. **Admin permissions granularity** — port the legacy checkbox-permissions 1:1 (recommended) vs simplify to 3 admin levels.

---

## Appendix — Inventory of key legacy entry points

- Controllers: `Admin.php` (~140 methods) · `Home.php` (~90) · `User.php` (~40) · `Api.php` (~55) · `Api_instructor.php` (~40) · `Payment.php` (5 gateways) · `Login/Sign_up/Blog/Page/Sitemap/Data_center/Files/Api_files/Modal/View/Updater/Install`
- Payment gateways in code: PayPal, Stripe, Razorpay (web+API) · PayU, SSLCOMMERZ, Xendit, Doku, Pagseguro, Skrill (models) · offline (addon)
- Video providers: html5, youtube, vimeo, iframe, external URL, Amazon S3, Wasabi, Google Drive, Academy Cloud (vendor API)
- Question types: multiple_choice, single_choice (+true/false), fill_in_the_blank (image used in options)
- ~80 settings keys incl.: `system_name`, `language`, `currency/system_currency`, `instructor_revenue`, `course_accessibility`, `allowed_device_number_of_loging`, `student_email_verification`, `video_upload_location`, watermarks, SMTP, GA/Meta pixel, socials, drip `drip_content_settings`, `course_selling_tax`
- 16 languages incl. RTL (arabic, urdu)
