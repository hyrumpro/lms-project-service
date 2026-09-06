# Academy LMS → Next.js — Complete Clone Build Specification
### AI-executable blueprint: file-review map · architecture · data model · routes · feature specs · migration
_(Supersedes `NEXTJS-REBUILD-PLAN.md`, which remains as the executive summary.)_

---

## 0. Mission & operating rules for the implementing AI

**Mission:** Rebuild *Academy LMS v7.1* (CodeIgniter 3 / PHP / MySQL) as a modern **Next.js 15 (App Router) + TypeScript + PostgreSQL (Prisma)** application with **full feature parity**, including the features that live behind the missing "addons" in the legacy copy (certificates, offline payment, live classes, forum, course bundles, ebooks, tutor booking — see §7.6). The product is a course marketplace: admins manage everything, instructors create/sell courses, students buy/learn.

**Legacy source of truth:** everything in this repo under `./Academy-LMS`. When a behavior is ambiguous, read the cited legacy file and replicate its *observable behavior* (what users see and what gets stored), not its code style.

**Hard rules**

1. **Parity-first.** Every legacy user journey must work end-to-end before any "improvements". §3 lists behaviors that must be replicated *exactly* (quiz grading, progress math, slugs, currency, expiry) because data and SEO depend on them.
2. **Modernize the internals, preserve the experience.** Join tables instead of comma-separated strings, webhook-driven payments instead of return-URL trust, typed settings instead of loose key/value — but the same screens, flows, and outcomes.
3. **One codebase** serves web + REST API (`/api/v1`) so the existing mobile apps can be re-pointed later (legacy: `Api.php`, `Api_instructor.php`).
4. **Typed end-to-end:** Prisma schema is the single source of truth; Zod schemas validate every server boundary; no `any` in domain logic.
5. **Security floor** (fixes legacy debt): bcrypt/argon2 password hashing, CSRF-safe Server Actions, signed upload URLs, RBAC on every mutation, secrets encrypted at rest, rate-limited auth endpoints, webhook signature verification. No unsalted SHA-1 for new passwords (legacy hashes handled per §9.3).
6. **Tests as definition-of-done:** every feature spec in §7 has acceptance criteria; critical flows get Playwright E2E (§10).
7. Never invent legacy features that don't exist; never silently drop ones it does. `Checker.php` is dead foreign code (belongs to a different product) — ignore it.

**Conventions for all code written**

- Server Components by default; `"use client"` only for interactive islands (player, dnd builders, forms with live validation).
- Mutations = Server Actions (or `app/api/v1/*` route handlers when mobile-facing). All input through Zod; all errors typed (`ActionError`), no thrown-500 leaks.
- DB access only in `src/server/{queries,actions,services}`; components never touch Prisma directly.
- Money stored in **minor units (integer cents)** + currency code; legacy stores decimals — ETL converts.
- Dates: `Date` (UTC) in DB, rendered via `Intl` with the settings timezone (legacy: `timezone` setting).
- File paths in code: `@/` alias to `src/`.
- Naming: routes kebab-case; Server Actions `verbNoun` (e.g. `createCourse`, `enrollStudent`); DB snake_case in Prisma `@map`.

---

## 1. Legacy codebase map — which files to review, and for what

Root: `./Academy-LMS`. Read these before building the corresponding feature (§7 references them by ID below).

### 1.1 Core plumbing (read first, once)
| File | What to extract |
|---|---|
| `application/config/routes.php` | custom routes incl. addon routes (certificates, bundles, ebooks, tutors, blogs, custom pages) → §6 redirect map |
| `application/config/autoload.php`, `database.php`, `constants.php` | loaded models/helpers/libraries; DB config shape |
| `application/helpers/common_helper.php` | **~40 global functions** the whole UI leans on: `get_settings`, `get_frontend_settings`, `currency`, `currency_code_and_symbol`, `slugify`, `lesson_progress`, `course_progress`, `nice_number`, `seconds_to_time_format`, `time_to_seconds`, `custom_date`, `get_past_time`, `ellipsis`, `get_video_extension`, `get_lesson_type`, `next_lesson`, `get_current_banner`, `has_permission`, `check_permission`, `is_root_admin`, `validate_cart_items`, `get_seo_data`, `themeConfiguration`, `resizeImage`, `upload_description_images` |
| `application/helpers/user_helper.php` (89 ln) | `get_user_role`, `is_purchased`, `enroll_status` (valid/expired/false → access control for the player) |
| `application/helpers/multi_language_helper.php`, `languages/*.json` | phrase resolution + 16 dictionaries (1,088 English phrases) |
| `application/helpers/addon_helper.php` | `addon_status`, `certificate_eligibility`, `generate_certificate` |
| `application/models/User_model.php` | auth internals — **unsalted `sha1()` password** (lines 47, 105, 226, 275–300), profile updates, image `md5(rand)` naming |
| `application/models/Jwt_model.php` + `application/libraries/TokenHandler.php` | mobile JWT (HS256, hardcoded key `academy-lms-api-token-handler`) — replaced, but response shapes needed for API parity |
| `application/libraries/` (Stripe/, razorpay-php, openpayu_php, xendit, doku_php, Paystack.php, facebook-sdk-5.x, s3-vendor, phpqrcode, phpword-master, Format.php, REST_Controller.php) | gateway/SDK inventory: confirms every integration we must re-implement |

### 1.2 Controllers (the feature surface)
| File | Methods of note (grep `function \w+`) |
|---|---|
| `controllers/Admin.php` (4,449 ln, ~140 methods) | dashboard, categories, instructors/users/admins CRUD + permissions, enrol_student/enrol_history/CSV exports, admin/instructor revenue, purchase_history, invoice, all settings pages (system/frontend/payment/notification/social_login/instructor/theme/seo/sitemap/wasabi/bbb/open_ai), courses moderation (pending/active, duplicate, change_course_author, change_course_status_for_admin), curriculum mgmt (sections/lessons/quiz_questions + `ajax_sort_*`), language manager (`manage_language`, `update_phrase_with_ajax`, `language_import/export`, `update_language_direction`), blog mgmt, coupons, badges, custom fields designer, home page builder (`home_page_builder`, `home_page`, `preview_home_page`, `home_page_layout_update`, `upload_page_builder_image`, `developer_file_elements`, `getDomSelectorPath`), newsletters (4 screens + history + statistics), contact, resource_files, academy_cloud, data_center, cronjob, reviews CRUD, instructor_payout + paypal/stripe/razorpay checkout for payouts, drip_content_settings, student_academic_progress/quiz_result, student_certificate |
| `controllers/Home.php` (2,268 ln, ~100 methods) | public: home, courses (+ `set_layout_to_session`), course, instructor_page, toggle_following, search, faq, contact_us, policies, compare, page_not_found; student: shopping_cart, handleCartItems/handle_buy_now, apply_coupon, refreshShoppingCart*, payment + paypal/stripe/razorpay checkout+payment, course_purchase, invoice, purchase_history, my_courses, my_wishlist, my_messages, my_notifications, profile/update_profile, badges, dashboard; learning: lesson, pdf_canvas, submit_quiz, save_quiz_result, view_answer_sheet, check_course_progress, update_watch_history_with_duration/manually, preview_free_lesson, go_course_playing_page, course_playing_page_layout; misc: gift flow (check_gift_user, gift_to_user_id, coupon_offer_100_percent), subscribe_to_our_newsletter, dark_and_light_mode, site_language/switch_language, mobile webviews (quiz/live_class/payment/lesson), get_remote_video_duration |
| `controllers/User.php` (1,560 ln) | instructor studio: dashboard, courses/course_actions/course_form, sections, lessons, quizes, quiz_questions, payout_settings, sales_report, payout_report, withdrawal, manage_profile, invoice, remove_an_instructor, is_the_course_belongs_to_current_instructor, plus shared admin-like: BBB (`save_bbb_meeting`, `start_bbb_meeting`, `join_bbb_meeting`), AI (`chat_gpt`, `gpt_assistant`, `ai_img_download`), student_academic_progress, student_certificate, resource_files, custom_field_* designer, blog authoring (add/edit/pending) |
| `controllers/Login.php` (353 ln) | validate_login, register, fb_validate_login, logout, forgot_password_request/change_password, resend_verification_code, verify_email_address, check_recaptcha_with_ajax, new_login_confirmation |
| `controllers/Payment.php` (851 ln) | regional gateways: create_stripe_payment, create_ssl_commerz_payment, create_payu_payment, create_xendit_payment, create_doku_payment (+doku_ipn/log), pay_by_cashfree, create_maxicash_payment, aamarpay_payment_link, tazapay_payment_form, success_course_payment, success_instructor_payment |
| `controllers/Api.php` (881 ln, ~55 methods) | student mobile API (JWT): auth/login/signup/verify, catalog (top/categories/filter/search), course object/sections/lessons, wishlist toggle, enroll free, quiz submit, progress update, profile update, bundles, **forum endpoints** (forum_add_questions, search, replies, votes, delete) |
| `controllers/Api_instructor.php` (523 ln) | instructor mobile API: courses CRUD, sections/lessons CRUD + sort, pricing, sales report, payout report, withdrawal, live class |
| `controllers/Api_files.php` | file serving for the app |
| `controllers/Data_center.php` | `exportDatabase` (DB backup UI) |
| `controllers/Sitemap.php` | sitemap.xml generation |
| `controllers/Page.php`, `Modal.php`, `View.php`, `Files.php` | custom pages, modal partials, file serving |
| `controllers/Checker.php` | **dead foreign code (Ekattor school system) — do NOT review, do NOT port** |

### 1.3 Models (business logic)
| File | Key logic |
|---|---|
| `models/Crud_model.php` (5,570 ln, ~250 fns) | everything: catalog queries (`get_courses`, `filter_course`, `get_top_courses/categories/instructors`, `get_related_courses`), curriculum CRUD + sorting, quiz (`add_quiz`, `manage_mcq_choice_question`, `manage_fill_in_the_blank_question`, `get_quiz_questions`), enrollment/purchase (`enrol_student`, `enrol_to_free_course`, `course_purchase`, `check_coupon_validity`, `get_discounted_price_after_applying_coupon`), progress (`get_watch_histories`, `update_last_played_lesson`, `update_watch_history_with_duration`, `update_watch_history_manually`), payouts (`get_payouts`, `add_withdrawal_request`, `get_total_revenue`), messaging, notifications, newsletters, blogs, custom pages, SEO (`get_seo_meta_tags`, `get_seo_by_route`), BBB (`callBbbApi`), badges, coupons, wishlist, settings updaters, language/theme file utilities |
| `models/Payment_model.php` (1,025 ln) | per-gateway verification: `check_paypal_payment`, `check_stripe_payment`, `check_razorpay_payment`, `check_skrill_payment`, `check_payu_payment`, `check_sslcommerz_payment`, `check_pagseguro_payment`, `check_xendit_payment`, `check_doku_payment`; `razorpayPrepareData` |
| `models/Email_model.php` (959 ln) | 18 mail events (see §12.4) + `send_smtp_mail`; templates rendered from `views/email/common_template.php` + `notification_settings.template` |
| `models/Video_model.php`, `Academy_cloud_model.php` | video duration probing (ffprobe/remote), vendor cloud upload — replaced by our storage design |
| `models/Api_model.php` (1,464 ln), `Api_instructor_model.php` (1,426 ln) | mobile API payload shapes — the contract to mirror in `/api/v1` |
| `models/Social_login_modal.php` | Facebook/LinkedIn/Twitter/Google OAuth profiles |

### 1.4 Views (UI truth — screens to replicate)
| Directory | Screens |
|---|---|
| `views/frontend/default-new/` (~100 files) | every public/student page: home + 8 alternate template skins (`home_university2`, `home_fitness`, `home_marketplace`, `home_kindergarten`, `home_cooking2`, `home_language`, `home_development`, `home_elegant` + assets), courses_page (+grid/list/sidebar/sorting partials), course_page (+curriculum/info/reviews/instructor/preview_modal/custom_field partials), shopping_cart, login/sign_up/forgot, my_courses, my_wishlist, my_messages, notifications, purchase_history, invoice, profile, instructor_page, instructor_following, blogs*5, contact_us, website_faq, compare, policies, badges, live_class_scadule, payout_settings, account_disable, eu-cookie |
| `views/backend/admin/` (~170 files) | every admin screen incl. all lesson-type add/edit forms (`{video,youtube,vimeo,html5,iframe,audio,document,text,image,wasabi,google_drive,academy_cloud}_type_lesson_{add,edit}.php`), quiz forms (`quiz_add/edit`, `question_add/edit`, `quiz_fields_type_wize`), payment settings, language manager, page builder, newsletters, seo/sitemap settings |
| `views/backend/user/` (~70 files) | instructor studio (mirrors admin minus platform settings) + payout_report, withdrawal, sales_report |
| `views/lessons/` | **the player**: `index.php` (shell), `sidebar.php` (curriculum + progress), `bottom_tabs.php` (Summary / Attached Files / Certificate / Forum / Noticeboard / Live class / Assignment / BBB), `general_course_content_body.php` (lesson renderer switch), `plyr_config.php` (video player init + progress events), `quiz_view.php`, `quiz_answer_sheet.php`, `quiz_result.php`, `pdf_canvas.php` (certificate canvas) |
| `views/mobile/` | app webviews: payment_gateway, payment_model, quiz*, live_class |
| `views/email/`, `views/install/` | email base template; installer flow (for the seed script design) |

### 1.5 Assets (UI libraries to swap)
`assets/global/`: plyr (video), select2, tagify, toastr, jquery-ui (sortable), html2canvas + `pdf-canvas` (certificates), mail templates · `assets/frontend/default-new/`: slick carousel, summernote (rich text) · `assets/lessons/`: flipclock-timer (quiz countdown). Modern equivalents chosen in §4.3.

### 1.6 Database
`uploads/install.sql` — **46 tables** (schema + seed rows: currencies, gateways, roles, notification templates, email stamp, language phrases). This is the definitive column list; §5 maps every table.

---

## 2. Condensed legacy analysis (what the product does)

Four roles: **student** (buy/learn), **instructor** (create/sell, applied & approved by admin, or `allow_instructor` self-service), **admin** (platform owner; multiple admins with granular permission checkboxes), **root admin** (`is_root_admin`).

- **Catalog:** categories → sub-categories; courses have status `draft|pending|active` (instructors submit → admin approves; admins can act directly). Multi-instructor via comma-separated `course.user_id`. Free vs paid (`is_free_course`, `discount_flag`+`discounted_price`). Course expiry (`expiry_period` days → `enrol.expiry_date`). Drip content per section (`section.restricted_by`) when `course.enable_drip_content`. Custom fields render extra sections on course pages. Reviews (1–5 + text) by enrolled students only. Related courses by category.
- **Learning:** enrollment → `lessons` player. Lesson types: video (providers: html5/uploaded, youtube, vimeo, iframe, external URL, amazon s3, wasabi, google drive, academy cloud), audio, document (pdf/download), text (summernote HTML), quiz. Free-preview lessons (`is_free`). Progress: completed lessons (manual mark + auto on watch ≥ configured %), % per course, resume (`watching_lesson_id`, `current_duration`). Quizzes: questions of type multiple_choice (checkbox), single_choice (+true/false), fill_in_the_blank; `options`/`correct_answers` JSON; grading = **sorted-array exact match**; results stored; attempts limited (`lesson.quiz_attempt`); flipclock timer UI.
- **Commerce:** cart + wishlist (session → user merge), buy-now, coupons (%-off, expiry), gifting (gift to another user; 100%-coupon trick `coupon_offer_100_percent`), checkout via ~10 gateways (PayPal, Stripe, Razorpay, PayU, SSLCOMMERZ, Xendit, Doku, Cashfree, Maxicash, AamarPay, TazaPay, Skrill, PagSeguro, Paystack, offline), tax setting, invoices (printable), purchase history, **revenue split** (`admin_revenue`/`instructor_revenue` per payment row; instructor % from settings), instructor payout requests → admin pays via PayPal/Stripe/Razorpay or marks paid.
- **Community:** messages (1:1 threads), notifications (system bell + email per event with editable templates), reviews, instructor following, badges (condition_from/to on type), forum Q&A (addon; `comment` polymorphic + votes), blog (categories, popular/latest, comments, likes; instructor posts moderated), newsletter (subscribers, campaigns, send + statistics), contact form inbox.
- **CMS/platform:** home page builder (drag-drop layouts; 9 template skins; `home_pages` table with JSON; image uploads), frontend settings (banners, section toggles, footer, custom CSS/embed codes, GA, Meta Pixel, cookies), custom pages, per-route SEO + OG + JSON-LD + sitemap.xml, theme manager (upload/activate), language manager (inline phrase editing, import/export, RTL), Academy Cloud browser, Data center (DB export), cronjob page, certificate addon (html2canvas→PDF + verify route), live classes (BBB native; Zoom/Jitsi addon), AI (OpenAI settings, chat assistant for instructors, AI image gen).

---

## 3. Behavior contracts — replicate exactly (data/SEO depend on these)

1. **Slug format:** `slugify(title)` = lowercase, non-alphanumerics → `-`, trimmed (mirror `common_helper::slugify`); URLs append `-` + `course.id` (e.g. `/course/learn-ecommerce-23`), so redirects from legacy URLs are mechanical.
2. **Quiz grading:** for each question, `sort(correct_answers) deep-equals sort(submitted_answers)` → question correct; score = correct/total; store submitted + correct arrays. (Add optional per-question partial scoring later, default off.)
3. **Course progress %:** `course_progress = round(completed_lessons / total_lessons * 100)` where completed lessons are recorded in `watch_histories.completed_lesson` JSON in legacy → new `LessonProgress` rows; aggregate view recomputes on write.
4. **Video resume:** heartbeat posts `current_duration` seconds for student+lesson (`watched_duration`); player seeks to it on load; `watched_counter` increments per play.
5. **Enrollment access:** `enroll_status(course, user)` → `valid | expired | false`; player redirects non-enrolled to the course page with "You have to buy the course first"; expired → "accessibility has expired". Instructors of the course and admins bypass.
6. **Money:** legacy stores decimal amounts; UI formats via `currency(price)` = symbol + amount with 2 decimals, position from `currency_position` setting (`left|right` of `system_currency`). New: integer minor units; format identical.
7. **Multi-instructor ownership:** anyone in the instructor list can edit the course (check `is_course_instructor`); admin can reassign (`change_course_author`); instructor can remove a co-instructor (`remove_an_instructor`).
8. **Course status flow:** instructor create → `pending` (admin approval; email on status change via template) → `active` → admin can deny/restore. Admin-created courses are instantly `active` (`is_admin` flag).
9. **Discount application order:** coupon applies to the already-discounted price: `price_with_course_discount - (price_with_course_discount * coupon.discount_percentage / 100)`; free if result ≤ 0 (legacy `coupon_offer_100_percent`).
10. **Instructor revenue share:** each `payment` row stores `admin_revenue` + `instructor_revenue` (split at purchase time from `instructor_revenue` % setting, after tax); payout ledger draws from it.
11. **JWT (mobile):** HS256 with the legacy key during the compatibility window (§7.20) so old apps keep working, payload = `{user_id, …}` mirrored from `TokenHandler`.
12. **i18n keys:** phrases are English sentences used as keys (`site_phrase('You have to buy the course first')`); keep key strings identical so `languages/*.json` seed works.

---

## 4. Target architecture

### 4.1 Stack (locked)
Next.js 15 App Router + TypeScript · Prisma + PostgreSQL (Neon/Supabase) · Better Auth (credentials + Google/Facebook/LinkedIn OAuth + email verification) · Tailwind + shadcn/ui · TanStack Query (client islands) · Zod · next-intl · Vidstack player (+ YouTube/Vimeo iframes) · Tiptap (rich text) · dnd-kit (sorting) · Recharts (admin charts) · @react-pdf/renderer (certificates/invoices) · S3-compatible storage (R2/S3) + Cloudflare Stream (or Mux) for uploaded video · React Email + Resend/SMTP · Inngest (jobs/cron) · Meilisearch (phase 2 search; start with Postgres FTS) · Vitest + Playwright · Pino logging.

### 4.2 Source tree
```
src/
  app/
    (public)/            page.tsx (home), courses/, course/[slug], instructor/[slug],
                         blog/, blog/[slug], p/[slug] (custom pages), faq, contact,
                         about, terms, refund-policy, privacy-policy, cookie-policy, compare
    (auth)/              sign-in, sign-up, verify-email, forgot-password, reset-password
    learn/[courseId]/[lessonId]/   ← player shell (auth + enrollment guard)
    dashboard/           my-courses, wishlist, shopping-cart, checkout, purchase-history,
                         invoices/[id], messages, notifications, certificates, badges, profile
    studio/              (instructor) courses, courses/new, courses/[id]/edit (wizard),
                         courses/[id]/curriculum, quizzes, sales, payouts, withdraw,
                         blog, applications/new, profile, live-classes
    admin/               dashboard, courses (tabs: active/pending), courses/[id],
                         categories, instructors, students, admins, permissions,
                         enrollments, revenue, payouts, reviews, coupons, badges,
                         blog, newsletters, subscribers, contact, resource-files,
                         settings/{system,frontend,payment,notification,email-templates,
                                   social-login,instructor,seo,sitemap,language,openai,theme},
                         page-builder, custom-fields, custom-pages, live-classes, academy-cloud
    certificate/[code]/  public verify + PDF download
    api/v1/              auth/, courses/, categories/, sections/, lessons/, quiz/,
                         enrollments/, wishlist/, progress/, profile/, forum/,
                         instructor/{courses,curriculum,sales,payouts,live-classes}/
    api/webhooks/        stripe/, paypal/, razorpay/, regional/[gateway]/
    sitemap.ts, robots.ts, opengraph-image.tsx
  components/            ui/ · course/ · player/ · checkout/ · studio/ · admin/ · shared/
  server/
    actions/             auth.ts, course.ts, curriculum.ts, quiz.ts, enrollment.ts,
                         payment.ts, payout.ts, review.ts, blog.ts, newsletter.ts,
                         settings.ts, user.ts, admin.ts, builder.ts, custom-field.ts, live-class.ts
    queries/             (RSC loaders, same domain split)
    services/            domain logic with side effects (payments, progress, emails, jobs)
  lib/                   auth.ts (RBAC), db.ts, storage.ts, video.ts, payments/{stripe,paypal,razorpay,regional}.ts,
                         email.ts, i18n.ts, seo.ts, money.ts, ai.ts, jwt-legacy.ts
  prisma/                schema.prisma, seed.ts, migrations/
scripts/migrate/         MySQL→Postgres ETL (see §9)
```

### 4.3 Component-mapping cheatsheet (legacy asset → new)
| Legacy | New |
|---|---|
| plyr (`plyr_config.php`) | Vidstack (`<MediaPlayer>`) + heartbeat → progress action |
| select2 | shadcn `Combobox` |
| tagify | shadcn multi-tag input |
| toastr | sonner toasts |
| jquery-ui sortable / dragula | dnd-kit |
| summernote | Tiptap (sanitize on render) |
| slick carousel | embla-carousel (shadcn) |
| flipclock (quiz timer) | custom React countdown (persist deadline server-side) |
| html2canvas + pdf-canvas (certificate) | @react-pdf/renderer template |
| DataTables server-side (`courses-server-side.php`) | TanStack Table + server pagination/filter actions |

### 4.4 Cross-cutting designs
- **RBAC:** `User.role {student,instructor,admin}` + `AdminPermission` row (JSON flags mirroring legacy `permissions.permissions`); `requireRole()`, `requireAdminPerm(flag)` guards in every action + layout middleware. Instructor = `role=instructor` OR approved `Application`.
- **Settings service:** typed domain settings (`SystemSettings`, `FrontendSettings`, `PaymentSettings`, `InstructorSettings`, `SeoSettings`, `DripSettings`, `SmtpSettings`, `OpenAiSettings`…) stored as one Zod-validated JSON per domain in `Setting(key,value)`; cached with tag `settings`; invalidation on update. Full key inventory §8.
- **Storage:** `lib/storage.ts` — presigned PUT for uploads (images, lesson files, resources), public read for static, signed read for lesson videos; paths mirror legacy `uploads/*` buckets (`thumbnails/`, `lesson_files/`, `blog/`, `user_image/`, `document/`, `description-images/`, `home-pages/`, `captions/`, `resource_files/`, `seo-og-images/`).
- **Video pipeline:** lesson video upload → presigned S3 → Inngest job transcodes/registers to Cloudflare Stream (or stores HLS) → `lesson.videoUrl` updated; external providers (youtube/vimeo/iframe/external) store provider+URL only; duration probing job replaces `get_remote_video_duration`.
- **Payments:** `GatewayAdapter { createCheckout(order), verifyWebhook(req), refund() }`; `Order` (line snapshot, totals, tax, coupon) → gateway session → webhook → idempotent `fulfillOrder` (creates `Payment` + `Enrollment`s, splits revenue, fires notifications, clears cart). Regional gateways implement the same adapter (redirect flow). Offline = bank instructions + admin approve UI.
- **Notifications:** `notify(event, actor, data)` → in-app rows + (if enabled in `NotificationTemplate`) email via React Email template; templates seeded from legacy `notification_settings` (§12.4).
- **Jobs (Inngest):** webhook handlers, email fan-out (newsletter), video processing, cron: enrollment expiry, drip unlocks recompute, payout reminders, sitemap regen, DB backup export.

---

## 5. Complete Prisma schema (build this verbatim, then extend)

> **IMPLEMENTATION STATUS (2026-09-03):** Milestone M0 is done in `academy-next/`. Per project decision the ORM is **Drizzle**, not Prisma — the schema below is kept as the canonical data-map reference. Implemented tables: `academy-next/src/db/schema/{auth,catalog,learning,platform}.ts` (Better Auth tables incl. 1.7's `account.issuer`; catalog; enrollments/progress/quizzes; settings/home pages/custom pages/SEO). Deviations: pricing columns inlined on `courses`; better-auth `user` table carries profile fields via `additionalFields`. Auth (Better Auth) is wired and smoke-tested live (sign-up/sign-in verified against Postgres). Dev ports: app `:3100`, Postgres host `:5433` (3000/5432 are used by other projects on this machine).

> Mapping from legacy tables shown inline. Money = Int minor units. IDs: cuid, but keep `legacyId Int?` where ETL needs to match.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ───────────────────────── identity (legacy: users, role, permissions, ci_sessions)
enum Role { STUDENT INSTRUCTOR ADMIN }

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  passwordHash    String?              // bcrypt/argon2 (Better Auth Account may hold this)
  legacyPassword  String?              // unsalted sha1 from legacy, until re-hash (§9.3)
  firstName       String
  lastName        String
  role            Role     @default(STUDENT)
  isInstructor    Boolean  @default(false)
  phone           String?
  address         String?
  title           String?              // headline, e.g. "PhD, Math"
  skills          String?
  biography       String?
  socialLinks     Json?                // legacy users.social_links
  image           String?
  status          UserStatus @default(ACTIVE)   // legacy: disabled → ACCOUNT_DISABLED
  emailVerified   Boolean  @default(false)
  verificationCode String?
  payoutMethod    PayoutMethod?
  applications    Application[]
  coursesOwned    CourseInstructor[]
  enrollments     Enrollment[]
  progress        CourseProgress[]
  lessonProgress  LessonProgress[]
  quizResults     QuizResult[]
  reviews         Review[]
  wishlist        WishlistItem[]
  followings      Following[]  @relation("follower")
  followers       Following[]  @relation("following")
  threadsA        MessageThread[] @relation("threadA")
  threadsB        MessageThread[] @relation("threadB")
  notifications   Notification[]
  posts           Post[]
  payouts         Payout[]
  payments        Payment[]
  orders          Order[]
  giftSent        Enrollment[] @relation("giftedBy")
  adminPermissions AdminPermission?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
enum UserStatus { ACTIVE ACCOUNT_DISABLED }

model AdminPermission {           // legacy: permissions (per admin)
  id       String @id @default(cuid())
  admin    User   @relation(fields: [userId], references: [id])
  userId   String @unique
  flags    Json               // {courses:true, users:false, ...} mirror legacy checkboxes
}

model Application {               // legacy: applications (become-an-instructor)
  id        String  @id @default(cuid())
  user      User    @relation(fields: [userId], references: [id])
  userId    String
  address   String
  phone     String
  message   String
  document  String?               // storage path
  status    String  @default("pending")   // pending|approved|rejected
  createdAt DateTime @default(now())
}

model PayoutMethod {              // legacy: users.payment_keys
  id           String @id @default(cuid())
  user         User   @relation(fields: [userId], references: [id])
  userId       String @unique
  type         String             // paypal|stripe|razorpay|bank
  credentials  Json               // encrypted
}

// ───────────────────────── catalog (legacy: category, course, section, lesson,
//                                  question, resource_files, custom_fields, tag)
model Category {
  id        String  @id @default(cuid())
  parent    Category?  @relation("tree", fields: [parentId], references: [id])
  parentId  String?
  children  Category[] @relation("tree")
  name      String
  slug      String  @unique
  icon      String?          // legacy font_awesome_class
  thumbnail String?
  subThumbnail String?       // legacy sub_category_thumbnail
  courses   Course[]
  order     Int @default(0)
}

model Course {
  id            String @id @default(cuid())
  legacyId      Int?   @unique
  title         String
  slug          String @unique          // slugify(title); URL = /course/{slug}-{id}
  shortDescription String?
  description   String?
  outcomes      Json?                    // string[]
  requirements  Json?                    // string[]
  faqs          Json?                    // {question,answer}[]
  language      String
  level         String                   // beginner|intermediate|expert|any
  category      Category @relation(fields: [categoryId], references: [id])
  categoryId    String
  pricing       CoursePricing?
  instructors   CourseInstructor[]
  sections      Section[]
  enrollments   Enrollment[]
  reviews       Review[]
  progress      CourseProgress[]
  thumbnail     String?
  promoVideoUrl String?
  promoVideoProvider String?            // youtube|vimeo|html5|iframe|external
  status        CourseStatus @default(DRAFT)
  isTopCourse   Boolean @default(false)  // legacy is_top_course
  createdByAdmin Boolean @default(false) // legacy is_admin
  courseType    String @default("general") // general | scorm
  accessibility String @default("paid")   // legacy course_overview… actually course_accessibility setting → per-course free/paid
  expiryPeriod  Int?                     // days; null = forever (legacy expiry_period)
  enableDripContent Boolean @default(false)
  publishDate   DateTime?
  multiInstructor Boolean @default(false)
  metaKeywords  String?
  metaDescription String?
  customFieldValues Json?               // legacy custom_fields per-course values
  tags          Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
enum CourseStatus { DRAFT PENDING ACTIVE }

model CoursePricing {                 // legacy: course pricing columns
  id              String @id @default(cuid())
  course          Course @relation(fields: [courseId], references: [id])
  courseId        String @unique
  isFree          Boolean @default(false)      // legacy is_free_course
  price           Int  @default(0)             // minor units
  discountEnabled Boolean @default(false)      // legacy discount_flag
  discountedPrice Int  @default(0)
}

model CourseInstructor {              // replaces comma-separated course.user_id
  course       Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  courseId     String
  instructor   User   @relation(fields: [instructorId], references: [id])
  instructorId String
  isOwner      Boolean @default(false)          // legacy creator
  @@id([courseId, instructorId])
}

model Section {
  id        String @id @default(cuid())
  title     String
  course    Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  courseId  String
  order     Int    @default(0)
  unlockRule Json? // drip: {kind:"date",date}|{kind:"prevSection"}|{kind:"daysAfterEnroll",days}
  lessons   Lesson[]
}

model Lesson {
  id          String @id @default(cuid())
  legacyId    Int?   @unique
  title       String
  course      Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  courseId    String
  section     Section @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  sectionId   String
  order       Int @default(0)
  type        LessonType                       // legacy lesson_type
  // video lessons
  videoProvider VideoProvider?                 // legacy video_type
  videoUrl      String?                        // url or storage path or cloud id
  cloudVideoId  String?
  // audio / attachments / content
  audioUrl    String?
  attachment   String?
  attachmentType String?
  caption     String?                          // vtt path (legacy caption)
  summary     String?                          // text/HTML lesson body + video summary
  isFreePreview Boolean @default(false)        // legacy is_free
  quizMaxAttempts Int @default(1)               // legacy quiz_attempt
  durationSeconds Int @default(0)
  progress    LessonProgress[]
  attachments ResourceFile[]                   // legacy resource_files (lesson-level)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
enum LessonType  { VIDEO AUDIO DOCUMENT TEXT QUIZ }
enum VideoProvider { HTML5 YOUTUBE VIMEO IFRAME EXTERNAL S3 WASABI GOOGLE_DRIVE STREAM }

model Quiz {                                   // lesson.type=QUIZ links quizId
  id         String @id @default(cuid())
  lesson     Lesson @relation(fields: [lessonId], references: [id])
  lessonId   String @unique
  questions  Question[]
  results    QuizResult[]
}
model Question {                               // legacy: question
  id         String @id @default(cuid())
  quiz       Quiz  @relation(fields: [quizId], references: [id], onDelete: Cascade)
  quizId     String
  title      String
  type       QuestionType                      // legacy question.type
  numberOfOptions Int
  options    Json                              // string[] (or {text,image}[])
  correctAnswers Json                          // string[] of option ids
  order      Int @default(0)
}
enum QuestionType { MULTIPLE_CHOICE SINGLE_CHOICE FILL_IN_THE_BLANK }

model ResourceFile {                           // legacy: resource_files
  id String @id @default(cuid())
  lesson Lesson? @relation(fields: [lessonId], references: [id])
  lessonId String?
  title String
  file  String
}

model Tag {                                    // legacy: tag (polymorphic → explicit FKs)
  id String @id @default(cuid())
  tag String
  course Course? @relation(fields: [courseId], references: [id])
  courseId String?
}

// ───────────────────────── learning (legacy: enrol, watch_histories,
//                                  watched_duration, quiz_results, rating)
model Enrollment {                             // legacy: enrol
  id        String @id @default(cuid())
  legacyId  Int? @unique
  student   User  @relation(fields: [userId], references: [id])
  userId    String
  course    Course @relation(fields: [courseId], references: [id])
  courseId  String
  giftedBy  User?  @relation("giftedBy", fields: [giftedById], references: [id])
  giftedById String?
  source    EnrollmentSource @default(PURCHASE)
  expiresAt DateTime?                            // legacy expiry_date
  createdAt DateTime @default(now())
  @@unique([userId, courseId])
}
enum EnrollmentSource { PURCHASE FREE GIFT MANUAL BUNDLE }

model CourseProgress {                         // legacy: watch_histories
  id         String @id @default(cuid())
  student    User @relation(fields: [userId], references: [id])
  userId     String
  course     Course @relation(fields: [courseId], references: [id])
  courseId   String
  watchingLessonId String?
  completedLessons Int @default(0)             // derived count of LessonProgress
  percent    Int @default(0)                   // legacy course_progress
  completedAt DateTime?
  updatedAt  DateTime @updatedAt
  @@unique([userId, courseId])
}
model LessonProgress {                         // legacy: watched_duration
  id            String @id @default(cuid())
  student User @relation(fields: [userId], references: [id])
  userId  String
  lesson  Lesson @relation(fields: [lessonId], references: [id])
  lessonId String
  isCompleted Boolean @default(false)           // legacy in completed_lesson JSON
  lastPositionSeconds Int @default(0)          // legacy current_duration
  watchCount Int @default(0)                   // legacy watched_counter
  updatedAt DateTime @updatedAt
  @@unique([userId, lessonId])
}
model QuizResult {                             // legacy: quiz_results
  id           String @id @default(cuid())
  quiz         Quiz @relation(fields: [quizId], references: [id])
  quizId       String
  user         User @relation(fields: [userId], references: [id])
  userId       String
  answers      Json                            // [{questionId, submitted, correct, status}]
  obtainedMarks Int
  totalMarks   Int
  isSubmitted  Boolean @default(false)
  createdAt DateTime @default(now())
}
model Review {                                 // legacy: rating (polymorphic → course only v1)
  id String @id @default(cuid())
  user User @relation(fields: [userId], references: [id])
  userId String
  course Course @relation(fields: [courseId], references: [id])
  courseId String
  rating Int                                       // 1..5
  review String?
  createdAt DateTime @default(now())
  @@unique([userId, courseId])
}

// ───────────────────────── commerce (legacy: payment, payment_gateways, currency,
//                                  coupons, payout)
model Order {
  id String @id @default(cuid())
  user User @relation(fields: [userId], references: [id])
  userId String
  items OrderItem[]
  subtotal Int
  tax Int
  discount Int
  total Int
  coupon Coupon? @relation(fields: [couponId], references: [id])
  couponId String?
  status OrderStatus @default(PENDING)   // PENDING|PAID|FAILED|CANCELLED|PENDING_REVIEW(offline)
  gateway String?                       // paypal|stripe|razorpay|payu|...|offline
  gatewaySessionId String? @unique      // checkout session id
  payment Payment?
  createdAt DateTime @default(now())
}
model OrderItem {
  id String @id @default(cuid())
  order Order @relation(fields: [orderId], references: [id])
  orderId String
  course Course @relation(fields: [courseId], references: [id])
  courseId String
  unitPrice Int
  giftToEmail String?                    // legacy gifting
}
model Payment {                            // legacy: payment
  id String @id @default(cuid())
  order Order @relation(fields: [orderId], references: [id])
  orderId String @unique
  user User @relation(fields: [userId], references: [id])
  userId String
  gateway String
  amount Int
  tax Int
  adminRevenue Int
  instructorRevenue Int
  transactionId String?
  status String @default("completed")
  createdAt DateTime @default(now())
}
model Coupon {                             // legacy: coupons
  id String @id @default(cuid())
  code String @unique
  discountPercentage Int
  expiryDate DateTime
  orders Order[]
}
model GatewayConfig {                      // legacy: payment_gateways
  id String @id @default(cuid())
  identifier String @unique              // paypal, stripe, razorpay, payu, ...
  title String
  enabled Boolean @default(false)
  testMode Boolean @default(false)
  keys Json                                // encrypted
  currency String?
}
model Currency {                           // legacy: currency
  code String @id                          // e.g. USD
  name String
  symbol String
  position String @default("left")         // legacy currency_position setting
  supportedGateways String[]
}
model Payout {                             // legacy: payout
  id String @id @default(cuid())
  instructor User @relation(fields: [userId], references: [id])
  userId String
  amount Int
  method String                            // paypal|stripe|razorpay|bank
  status PayoutStatus @default(REQUESTED)  // REQUESTED|APPROVED|PAID|REJECTED
  reference String?                        // gateway transaction for payouts
  createdAt DateTime @default(now())
  paidAt DateTime?
}
enum PayoutStatus { REQUESTED APPROVED PAID REJECTED }

// ───────────────────────── community (legacy: message*, notifications, rating,
//                                  instructor_followings, badges, blogs*, contact,
//                                  newsletter*, comment)
model MessageThread {                      // legacy: message_thread + message
  id String @id @default(cuid())
  threadCode String @unique
  sender User @relation("threadA", fields: [senderId], references: [id])
  senderId String
  receiver User @relation("threadB", fields: [receiverId], references: [id])
  receiverId String
  messages Message[]
  lastMessageAt DateTime @default(now())
}
model Message {
  id String @id @default(cuid())
  thread MessageThread @relation(fields: [threadId], references: [id])
  threadId String
  body String
  senderId String
  readAt DateTime?
  createdAt DateTime @default(now())
}
model Notification {                       // legacy: notifications
  id String @id @default(cuid())
  user User @relation(fields: [userId], references: [id])
  userId String
  type String                              // course_purchase, course_status_change, ...
  title String
  body String
  url String?
  readAt DateTime?
  createdAt DateTime @default(now())
}
model NotificationTemplate {               // legacy: notification_settings
  id String @id @default(cuid())
  event String @unique                     // see §12.4
  systemEnabled Boolean @default(true)
  emailEnabled Boolean @default(true)
  subject String
  bodyTemplate String                      // {{placeholders}}
}
model Following {                          // legacy: instructor_followings
  follower User @relation("follower", fields: [followerId], references: [id])
  followerId String
  instructor User @relation("following", fields: [instructorId], references: [id])
  instructorId String
  createdAt DateTime @default(now())
  @@id([followerId, instructorId])
}
model Badge {                              // legacy: badges
  id String @id @default(cuid())
  type String                              // e.g. course_completed, quiz_score, instructor_sales
  title String
  description String?
  image String?
  conditionFrom Int
  conditionTo Int
  awardedTo BadgeAward[]
}
model BadgeAward {
  id String @id @default(cuid())
  badge Badge @relation(fields: [badgeId], references: [id])
  badgeId String
  user User @relation(fields: [userId], references: [id])
  userId String
  awardedAt DateTime @default(now())
  @@unique([badgeId, userId])
}
model Post {                               // legacy: blogs + blog_comments
  id String @id @default(cuid())
  title String
  slug String @unique
  categoryId String
  category PostCategory @relation(fields: [categoryId], references: [id])
  author User @relation(fields: [authorId], references: [id])
  authorId String
  thumbnail String?
  banner String?
  keywords String?
  description String?
  isPopular Boolean @default(false)
  status PostStatus @default(PUBLISHED)    // instructor posts → PENDING (moderation)
  comments PostComment[]
  likes Int @default(0)
  publishedAt DateTime @default(now())
}
model PostCategory {
  id String @id @default(cuid())
  title String
  slug String @unique
  subtitle String?
  posts Post[]
}
model PostComment {
  id String @id @default(cuid())
  post Post @relation(fields: [postId], references: [id])
  postId String
  user User @relation(fields: [userId], references: [id])
  userId String
  parentId String?
  parent PostComment? @relation("tree", fields:[parentId], references:[id])
  replies PostComment[] @relation("tree")
  body String
  likes Int @default(0)
  createdAt DateTime @default(now())
}
model ContactMessage {                     // legacy: contact
  id String @id @default(cuid())
  name String
  email String
  phone String?
  address String?
  message String
  hasRead Boolean @default(false)
  replied Boolean @default(false)
  createdAt DateTime @default(now())
}
model Subscriber {                         // legacy: newsletter_subscriber
  id String @id @default(cuid())
  email String @unique
  createdAt DateTime @default(now())
}
model NewsletterCampaign {                 // legacy: newsletters + newsletter_histories
  id String @id @default(cuid())
  subject String
  body String
  status String @default("draft")          // draft|sent
  sentAt DateTime?
  stats Json?                              // {sent, failed}
}

// ───────────────────────── Q&A forum (legacy addon: comment table + Api forum fns)
model ForumQuestion {
  id String @id @default(cuid())
  course Course @relation(fields: [courseId], references: [id])
  courseId String
  user User @relation(fields: [userId], references: [id])
  userId String
  title String
  body String
  votes Json          // [{userId, value}]
  replies ForumReply[]
  createdAt DateTime @default(now())
}
model ForumReply {
  id String @id @default(cuid())
  question ForumQuestion @relation(fields: [questionId], references: [id])
  questionId String
  user User @relation(fields: [userId], references: [id])
  userId String
  body String
  createdAt DateTime @default(now())
}

// ───────────────────────── CMS & platform (legacy: home_pages, frontend_settings,
//                                  settings, custom_page, seo_fields, bbb_meetings,
//                                  certificates, ebook*, bundle*, tutor_booking*)
model Setting {                            // legacy: settings + frontend_settings
  key  String @id                          // domain-prefixed, e.g. "system.name"
  value Json
}
model HomePageConfig {                     // legacy: home_pages
  id String @id @default(cuid())
  identifier String @unique                // default, university2, fitness, ...
  title String
  description String?
  sections Json                            // ordered [{type, props}]
  isPermanent Boolean @default(false)
  isActive Boolean @default(false)
}
model CustomPage {                         // legacy: custom_page
  id String @id @default(cuid())
  title String
  url String @unique
  content String
  buttonTitle String?
  buttonPosition String?
  status Boolean @default(true)
}
model SeoMeta {                            // legacy: seo_fields
  route String @id
  metaTitle String?
  metaKeywords String?
  metaDescription String?
  metaRobots String?
  canonicalUrl String?
  ogTitle String?
  ogDescription String?
  ogImage String?
  jsonLd Json?
}
model LiveClass {                          // legacy: bbb_meetings (+ zoom/jitsi addon)
  id String @id @default(cuid())
  course Course @relation(fields: [courseId], references: [id])
  courseId String
  provider LiveClassProvider @default(BBB)
  externalMeetingId String?
  moderatorPassword String?
  viewerPassword String?
  instructions String?
  startsAt DateTime
  joinUrl String?
  createdAt DateTime @default(now())
}
enum LiveClassProvider { BBB ZOOM JITSI }

model Certificate {                        // legacy addon: certificates
  id String @id @default(cuid())
  code String @unique                      // used in /certificate/{code}
  student User @relation(fields: [studentId], references: [id])
  studentId String
  course Course @relation(fields: [courseId], references: [id])
  courseId String
  issuedAt DateTime @default(now())
  @@unique([studentId, courseId])
}

model CourseBundle {                       // legacy addon: course bundles
  id String @id @default(cuid())
  title String
  slug String @unique
  description String?
  thumbnail String?
  price Int
  discountEnabled Boolean @default(false)
  discountedPrice Int @default(0)
  validityDays Int?                        // bundle access period
  courses CourseBundleItem[]
}
model CourseBundleItem {
  id String @id @default(cuid())
  bundle CourseBundle @relation(fields: [bundleId], references: [id])
  bundleId String
  course Course @relation(fields: [courseId], references: [id])
  courseId String
  @@unique([bundleId, courseId])
}

model Ebook {                              // legacy addon: ebook
  id String @id @default(cuid())
  title String
  slug String @unique
  description String?
  thumbnail String?
  file String
  price Int
  discountEnabled Boolean @default(false)
  discountedPrice Int @default(0)
  categoryId String?
  authorId String
  status String @default("active")
}

model TutorBooking {                       // legacy addon: tutor booking
  id String @id @default(cuid())
  tutor User @relation("tutor", fields: [tutorId], references: [id])
  tutorId String
  student User? @relation("student", fields: [studentId], references: [id])
  studentId String?
  title String
  description String?
  hourlyRate Int
  dayNames Json        // available days
  startTime String
  endTime String
  status String @default("available")      // available|booked
  bookingDate DateTime?
}
```
_(Plus Better Auth's own tables: `auth_user`, `session`, `account`, `verification` — map `User` to them per its adapter docs. `Course` gets a relation list for `ForumQuestion` and `Certificate`, `Ebook.category`, `TutorBooking` relations — add as written.)_

---

## 6. Route map — legacy → new (every page)

### 6.1 Public
| Legacy (controller/method) | New route | Notes |
|---|---|---|
| `home` / `home/home` | `/` | home builder renders active `HomePageConfig` |
| `home/courses` | `/courses` | grid/list via `?layout=`, filters `?category=…&sub=…&level=…&language=…&price=…&rating=…&search=…&sort=…` |
| `home/course/{slug}/{id}` | `/course/{slug}-{id}` | 301 redirect from legacy pattern |
| `home/search/{query}` | `/courses?search={query}` | |
| `home/instructor_page/{id}` | `/instructor/{id}` | keep numeric id + slug for parity; 301 |
| `home/preview_free_lesson`, `course_preview` | player preview mode on `/course/...` (modal) | |
| `home/compare` | `/compare?course-id-1=&…` | |
| `home/about_us`, `faq`, `contact_us`, `terms_and_condition`, `refund_policy`, `privacy_policy`, `cookie_policy` | `/about`, `/faq`, `/contact`, `/terms`, `/refund-policy`, `/privacy-policy`, `/cookie-policy` | content from settings |
| `page/{url}` | `/p/{url}` | custom pages |
| `blogs`, `blogs/{slug}` | `/blog`, `/blog/{slug}` | |
| `login`, `sign_up` (Login.php) | `/sign-in`, `/sign-up` | |
| `home/forgot_password` | `/forgot-password`, `/reset-password/{token}` | |
| `certificate/(:any)` | `/certificate/{code}` | public verify + PDF |
| `ebook`, `ebook/ebook_details/…` | `/ebooks`, `/ebooks/{slug}` | addon parity |
| `course_bundles`, `bundle_details/{slug}/{id}` | `/bundles`, `/bundles/{slug}-{id}` | addon parity |
| `tutors`, `schedules_bookings/{id}` | `/tutors`, `/tutors/{id}` | addon parity |
| `sitemap.xml` | `/sitemap.xml` (`app/sitemap.ts`) | |
| `home/page_not_found` | `not-found.tsx` | |

### 6.2 Student (auth)
| Legacy | New route |
|---|---|
| `home/my_courses` | `/dashboard/my-courses` |
| `home/lesson/{slug}/{courseId}/{lessonId}` | `/learn/{courseId}/{lessonId}` (redirects to last-played lesson when omitted) |
| `home/my_wishlist`, handleWishList | `/dashboard/wishlist` |
| `home/shopping_cart`, handleCartItems, apply_coupon | `/dashboard/shopping-cart` (+ checkout) |
| `home/payment`, paypal/stripe/razorpay_* | `/dashboard/checkout/{orderId}` → gateway → `/dashboard/checkout/success` |
| `home/purchase_history`, `home/invoice/{id}` | `/dashboard/purchase-history`, `/dashboard/invoices/{id}` |
| `home/my_messages` | `/dashboard/messages` |
| `home/my_notifications` | `/dashboard/notifications` |
| `home/profile`, update_profile | `/dashboard/profile` |
| `home/badges` | `/dashboard/badges` |
| `home/instructor_following` | `/dashboard/following` |
| `home/my_courses_by_category` | `/dashboard/my-courses?category=` |
| `home/pdf_canvas` (cert) | `/certificate/{code}/pdf` |
| `home/quiz_mobile_web_view`, `live_class_mobile_web_view`, `payment_gateway_mobile` | `/m/quiz/...`, `/m/live/...`, `/m/pay/...` (webview-safe shells) |

### 6.3 Instructor (`/studio`)
`User.php` → `/studio` (dashboard), `/studio/courses` (+ `?status=`), `/studio/courses/new`, `/studio/courses/{id}/edit` (tabs: basic/media/pricing/requirements/outcomes), `/studio/courses/{id}/curriculum` (sections/lessons/quiz dnd builder), `/studio/courses/{id}/quiz/{lessonId}` (question builder), `/studio/sales`, `/studio/payouts` (+ report), `/studio/withdraw`, `/studio/payout-settings`, `/studio/blog` (+ new/edit/pending), `/studio/live-classes` (BBB/Zoom create/start/join), `/studio/ai` (GPT assistant), `/studio/profile`, `/studio/applications/new` (become-an-instructor when not yet instructor), `/studio/invoices/{id}`.

### 6.4 Admin (`/admin`)
`Admin.php` → mirrors one-to-one: `/admin` (dashboard+charts), `/admin/courses/{active|pending}`, `/admin/courses/{id}`, `/admin/categories`, `/admin/instructors`, `/admin/students`, `/admin/admins`, `/admin/admins/{id}/permissions`, `/admin/enrollments` (+ history/CSV), `/admin/revenue`, `/admin/purchases`, `/admin/payouts` (+ pay flow), `/admin/reviews`, `/admin/coupons`, `/admin/badges`, `/admin/blog`, `/admin/newsletters` (+ compose/history/stats/subscribers), `/admin/contact`, `/admin/resource-files`, `/admin/custom-fields`, `/admin/custom-pages`, `/admin/page-builder`, `/admin/settings/**` (system, frontend, payment, notification, email-templates, social-login, instructor, seo, sitemap, language, openai, theme), `/admin/academy-cloud` → replaced by `/admin/media`, `/admin/data-center` → provider backups, `/admin/live-classes`, `/admin/certificates`.

### 6.5 REST API v1 (mobile parity; see `Api_model.php` payload shapes)
`/api/v1/auth/{login,register,verify,resend,forgot}` · `/api/v1/courses/{top,filter,search,course/{id}}` · `/api/v1/categories` · `/api/v1/courses/{id}/{sections,lessons}` · `/api/v1/{wishlist,cart,progress,quiz-submit,enroll-free,profile,password,upload-image}` · `/api/v1/bundles` · `/api/v1/forum/*` · `/api/v1/instructor/{courses,sections,lessons,sort,pricing,sales,payouts,withdrawals,live-classes}` · `/api/webhooks/{stripe,paypal,razorpay,regional/[gw]}`.
Keep legacy JWT (HS256, same secret) behind `Authorization: Bearer` during the compatibility window; issue modern tokens for new clients.

---

## 7. Feature specifications (build order within each = checklist)

> Format: **L:** legacy files to read · **D:** data · **B:** behavior · **UI** · **AC:** acceptance criteria.

### 7.1 Auth & accounts — L: `Login.php`, `Sign_up.php`, `User_model.php`, `Social_login_modal.php`, `views/frontend/default-new/{login,sign_up,forgot_password,verification_code,account_disable}.php`, `views/backend/admin/social_login.php`
- D: `User`, `Application`, `PayoutMethod`; Better Auth tables.
- B: email+password sign-in; sign-up (student; optional instructor checkbox when `allow_instructor`); email verification (link; legacy 6-digit also accepted for mobile parity); forgot/reset; logout; session persistence; account-disabled state blocks login with legacy message; Google/Facebook/LinkedIn OAuth via provider toggle in settings; reCAPTCHA toggle; rate limiting; legacy `sha1` password bridge (§9.3).
- UI: match legacy layouts; dark/light toggle persists (`dark_and_light_mode`).
- AC: all flows E2E; disabled account blocked; OAuth creates verified users; permission guards reject cross-role access.

### 7.2 Home page & builder — L: `views/backend/admin/home_page_builder/*`, `views/frontend/default-new/home*.php` (+ template skins), `Admin::home_page_builder/home_page/preview_home_page/home_page_layout_update`, `Crud_model::update_home_page_settings`
- D: `HomePageConfig`.
- B: admin picks a template skin (default + 8 alternate layouts), adds/reorders sections, edits props (titles, items, images), previews, activates. Sections (parity list): banner/hero, top-categories, top-courses, latest-courses, featured-courses, top-instructors, testimonials, FAQ, motivational-speech, promotional-section, custom HTML block, blog-latest. Public home renders active config in RSC with caching.
- UI: builder = sortable section list + per-section settings panel (dnd-kit), image upload to `home-pages/`, preview route.
- AC: legacy skins' visual order achievable; section toggles hide blocks; preview matches publish.

### 7.3 Catalog & search — L: `Home::courses`, `Crud_model::get_courses/filter_course/get_top_*`, `views/frontend/default-new/courses_page*.php`
- D: `Course`+`Category`.
- B: server-side filter (category, sub, level, language, price free/paid, rating), sort (newest, popular=most enrolled, rating, price asc/desc), pagination; layout toggle persisted in session like `set_layout_to_session`; search across title/description (Postgres FTS; Meilisearch later); category pages `/courses?category=slug`.
- AC: URL state shareable; counts match legacy queries; empty states.

### 7.4 Course detail page — L: `Home::course`, `views/frontend/default-new/course_page*.php` (7 partials), `Crud_model::get_course_by_id/get_related_courses/get_free_lessons`, `common_helper::get_seo_data`
- B: RSC page: promo video, title/rating/students, instructor card(s), tabs (description, curriculum accordion w/ free-preview lessons playable in modal, instructor, reviews, custom fields), sticky purchase card (price, discount strike, coupon hint, enroll/buy-now/wishlist, gifting, expires-in for owner, accessibility gate), JSON-LD + OG from `SeoMeta`.
- AC: free-preview lesson plays for anonymous users; enrolled users see "Go to course"; instructors/admins see manage links; Lighthouse ≥ 90.

### 7.5 Cart, checkout & payments — L: `Home::{shopping_cart,handleCartItems,handle_buy_now,apply_coupon,course_purchase,payment,paypal_*,stripe_*,razor_*,check_gift_user,gift_to_user_id,coupon_offer_100_percent}`, `Payment.php`, `Payment_model.php`, gateway libraries, `views/frontend/default-new/shopping_cart*.php`, `views/mobile/payment_*`
- D: `Order`, `OrderItem`, `Payment`, `GatewayConfig`, `Coupon`, `Currency`, `Enrollment`.
- B: cart (add/remove/validate like `validate_cart_items`), wishlist separate; coupon apply (§3.9); gift flow; tax (`course_selling_tax`); gateway choice filtered by currency support (`Currency.supportedGateways`); Stripe Checkout & PayPal Orders & Razorpay with webhooks → `fulfillOrder` (idempotency key = orderId): create `Payment` w/ revenue split, create `Enrollment`s (incl. gifted users if they exist; else credit), notify, invoice. Regional adapters: PayU, SSLCOMMERZ, Xendit, Doku (IPN), Cashfree, Maxicash, AamarPay, TazaPay, Skrill, PagSeguro, Paystack — redirect flow + callback verification mirroring each `check_*_payment`. Offline gateway: order → PENDING_REVIEW → admin approves in `/admin/revenue` → enrollment. 100%-discount coupon → free checkout path. Instructor payout payment (admin paying instructor via PayPal/Stripe/Razorpay) reuses adapters' payout-capable ones, else manual mark-paid.
- UI: cart page, checkout page (gateway radios + summary), success/fail states, mobile webview shell.
- AC: webhook replay safe; double-purchase blocked; coupon+discount math = §3.9; revenue rows match split; invoices PDF.

### 7.6 Learning player & progress — L: `views/lessons/*`, `Home::{lesson,update_watch_history_with_duration,update_watch_history_manually,check_course_progress,preview_free_lesson,go_course_playing_page}`, `Crud_model::{get_watch_histories,update_last_played_lesson,update_watch_history_with_duration,update_watch_history_manually}`, `common_helper::{course_progress,lesson_progress,next_lesson}`, `user_helper::enroll_status`
- D: `LessonProgress`, `CourseProgress`, `Lesson` all types.
- B: `/learn/{courseId}/{lessonId}` shell = sidebar (sections+lessons, completion ticks, lock icons for drip/unenrolled-free), content pane per type (video/audio/document/text/quiz), bottom tabs (Summary, Attached Files, Q&A→forum, Live class schedule, Certificate when eligible, Noticeboard placeholder for parity), autoplay next lesson, mark-complete + auto-complete on ≥90% watch, resume last position per lesson, resume last lesson per course (`update_last_played_lesson`), progress recompute (§3.3), heartbeat every 5s throttled, certificate CTA when 100% + certificate enabled, expiry gate (§3.5).
- UI: match legacy two-column shell; mobile responsive; keyboard accessible.
- AC: E2E — enroll → watch → auto-complete → 100% → certificate issue; resume works across devices; drip locks unlock via cron; expired re-buy prompt.

### 7.7 Quizzes — L: `Home::{submit_quiz,save_quiz_result,view_answer_sheet}`, `Crud_model::{add_quiz,edit_quiz,get_quiz_questions,manage_quiz_questions,manage_mcq_choice_question,manage_fill_in_the_blank_question,sort_question,get_quiz_score}`, `views/lessons/{quiz_view,quiz_result,quiz_answer_sheet}.php`, `views/backend/{admin,user}/{quiz_add,quiz_edit,question_add,question_edit,quiz_fields_type_wize}.php`, flipclock asset
- D: `Quiz`, `Question`, `QuizResult`.
- B: builder per lesson-type QUIZ; question forms per type (§12.3); student flow: start → questions (timer if set, server-enforced deadline) → submit → grade per §3.2 → result page (score, pass/fail threshold, answer sheet w/ correct/wrong highlight) → attempts limit → best/last result feeds `quiz_result` on `CourseProgress` (legacy stores quiz results in watch history JSON; keep on CourseProgress.quizSummary JSON).
- AC: exact-match grading parity; attempt cap enforced; answer sheet renders legacy-style.

### 7.8 Instructor studio — L: `User.php` (all), `views/backend/user/*` (~70 screens), `Crud_model::{get_courses_by_user_id,is_course_instructor,serialize_section,sort_section,sort_lesson,sort_question}`
- B: application flow → admin approval (notification+email); wizard (basic → media [thumbnail+promo] → pricing → requirements → outcomes → submit for review); curriculum builder: sections CRUD, lesson CRUD for all 10 types (forms parity: §12.2), dnd sort, quiz builder inline; multi-instructor: add co-instructor by email select, remove (`remove_an_instructor`), ownership rules §3.7; sales report (server-side table: course, student, gateway, gross/tax/net, date); payout report + withdrawal request (`add_withdrawal_request`) honoring min amount; payout settings (PayPal email / bank); blog authoring (auto `PENDING`); live class create/start/join (§7.14); AI assistant (§7.16); custom-field values for own courses.
- AC: instructor can create→submit→(admin approve)→sell→see sale→request payout E2E.

### 7.9 Admin suite — L: `Admin.php` (whole), `views/backend/admin/*`
- B (screens): dashboard charts (enrollments/revenue/users by period, Recharts); moderation (`pending` queue with preview player + approve/deny + status-change email); all CRUDs (categories w/ thumbnails+icons, students, instructors incl. disable, admins + granular permission checkboxes §5 `AdminPermission.flags`); manual enrollment (user×course select2→combobox + history + delete + CSV export mirroring `export_enrol_history_csv`); revenue (admin/instructor tabs, invoice view, purchase history w/ filter); payouts (request list → approve → pay via gateway or mark-paid w/ reference); reviews moderation (CRUD any review); coupons; badges CRUD (type/condition_from/condition_to/image); blog mgmt (approve instructor posts); newsletters (compose, send via job, history w/ per-recipient status, statistics, subscribers import/export); contact inbox (read/reply → email); resource files browser; custom-fields designer (sections + items, sorting, per-course render); custom pages CRUD; settings hub (§8); language manager (phrase grid w/ inline edit + AJAX save, import/export JSON, RTL direction flag, fallback to English); theme settings (active skin selector + upload custom theme zip — v1: skin selector only); SEO settings (per-route meta table + defaults) + sitemap settings; OpenAI settings; notification settings (per-event toggles + template editor with placeholders); email-template editor; cron status page (Inngest function list).
- AC: admin can perform every legacy admin action listed in §1.2 Admin.php row; permission flags hide screens.

### 7.10 Certificates — L: `helpers/addon_helper.php` (`certificate_eligibility`, `generate_certificate`), `views/lessons/pdf_canvas.php`, `Admin::student_certificate`, `User::student_certificate`, route `certificate/(:any)`
- B: eligible when course 100% complete (and/or quiz threshold); issue `Certificate` w/ code; student downloads PDF (@react-pdf/renderer template: accent border, logo, title, student name, course, date, verify URL/QR — `phpqrcode` parity); public verify page shows validity; admin/instructor view issued list.
- AC: PDF identical fields; verify page resolves code; badge hook fires.

### 7.11 Live classes — L: `Crud_model::{callBbbApi,checkBbbMeetingExists,join_bbb_meeting_by_curl_calls}`, `views/backend/{admin,user}/bbb_live_class*.php`, `views/lessons/bottom_tabs.php`, `Api_instructor live class fns`
- B: provider per class: **Zoom** (Server-to-Server OAuth: create meeting, start/join URLs), **Jitsi** (embed room, no keys), **BBB** (create via API w/ moderator/viewer passwords — parity). Schedule on course; student joins from player tab + course page schedule section; recordings link (Zoom) when available.
- AC: create→join works for each enabled provider; only enrolled see join links.

### 7.12 Community: messages, notifications, reviews, following, badges, forum — L: `Crud_model::{send_new_private_message,send_reply_message,mark_thread_messages_read,count_unread_message_of_thread,get_last_message_by_message_thread_code,get_notifications,my_notifications,rate,remove_rating,get_user_specific_rating,get_percentage_of_specific_rating,toggle... }`, `Home::{my_messages,my_notifications,rate_course,remove_rating,toggle_following,instructor_following,badges}`, `Api.php forum_*`
- B: 1:1 threads w/ unread counts + bell notifications (unread badge in header like `header_notification.php`); reviews only by enrolled, 1 per course, editable; follow/unfollow instructor + following page; badges auto-award job (course_completed n, quizzes passed, sales) per `Badge` conditions; forum: ask/reply/vote/delete per course, searchable (`Api.php` shapes).
- AC: all flows E2E; notification emails respect per-event toggles.

### 7.13 Blog, custom pages, contact, newsletter — L: `Blog.php`, `Crud_model` blog fns, `views/frontend/default-new/blogs*.php`, `views/backend/admin/blog*.php`, `Admin::{custom_page,add_custom_page,newsletters*}`, `Home::subscribe_to_our_newsletter`
- B: parity incl. popular/latest blocks, categories w/ subtitle, comments (threaded, likes), admin moderation of instructor posts; custom pages w/ optional CTA button; contact → inbox + email; subscribe form (footer) + double opt-in optional; campaign send via Inngest fan-out w/ stats.
- AC: instructor post → pending → approve → public; newsletter send status per subscriber.

### 7.14 SEO, i18n, currency, cookies, dark mode — L: `Sitemap.php`, `Crud_model::{get_seo_meta_tags,save_seo_settings,get_seo_by_route}`, `views/frontend/default-new/seo.php`, `multi_language_helper.php`, `Admin::{manage_language,update_phrase_with_ajax,language_import,export_language,update_language_direction}`, `Home::{site_language,switch_language,dark_and_light_mode}`, `views/frontend/default-new/eu-cookie.php`
- B: per-route SEO admin table + defaults; canonical + robots; OG images; JSON-LD (Course, BlogPosting); `sitemap.ts` (courses, blogs, pages, categories); hreflang alternates; next-intl w/ `[locale]` segment (16 locales from legacy JSON; fallback en); RTL for `ar`,`ur` (dir attr + logical CSS); currency table + position setting; cookie consent banner toggled by `cookie_status`; dark/light persisted.
- AC: `/ar` renders RTL; phrase override works; sitemap includes active courses/blogs.

### 7.15 Academy Cloud replacement → own media library — L: `Academy_cloud_model.php`, `Admin::academy_cloud*`, `Data_center.php`
- B: `/admin/media` = S3/Stream browser (upload, delete, copy URL) + `/admin/data-center` = DB backup export (provider CLI/SQL dump) + cron job; watermark settings (§8) applied at transcode when using Stream/Mux.
- AC: upload from admin visible in lesson form picker; backup downloadable.

### 7.16 AI features — L: `Admin::{open_ai_settings,chat_gpt,gpt_assistant,ai_img_download}`, `User::{chat_gpt,gpt_assistant,ai_img_download}`
- B: settings (API key, model, endpoints); studio assistant modal (draft course description/outcomes/quiz ideas); AI image gen for thumbnails (DALL·E); admin & instructor entry points.
- AC: works with key configured; graceful error without.

### 7.17 Mobile webviews & legacy app compatibility — L: `views/mobile/*`, `Api.php`, `Api_instructor.php`, `Api_files.php`, `Jwt_model.php`
- B: webview-safe routes under `/m/*` (quiz, live class, payment) that the existing app opens; `/api/v1` full parity incl. response JSON shapes from `Api_model` (field names preserved) during compatibility window; legacy JWT accept + new refresh tokens; `Api_files` file streaming w/ auth.
- AC: legacy app login + catalog + lesson list work against `/api/v1` (contract test suite mirroring `Api_model` responses).

### 7.18 Gamification/other small features checklist
Gifting (§7.5) · compare 3-way page · FAQ page from settings · motivational speech + promotional sections · device-login limit (Better Auth session cap policy) · watermarks · course expiry cron · offline payment approvals · instructor `become_an_instructor` public page + application note · newsletter footer form · EU cookie banner · account-disable page · multi-language switcher in header/footer.

### 7.19 Deliberately dropped
`Checker.php` (foreign dead code) · CI `ci_sessions` (auth lib) · `Updater.php`/`Install.php` (no in-app updater; migrations + seed replace) · `phpword`/`phpqrcode` libs (native equivalents) · Academy Cloud vendor API (own storage) · theme zip upload (config-based skins v1).

### 7.20 Addon-parity modules included (from missing addons, per §1.1 routes)
Certificates (7.10) · Live classes Zoom/Jitsi/BBB (7.11) · Forum (7.12) · Offline payment (7.5) · Course bundles (schema §5 + `/bundles` routes + bundle purchase → multiple enrollments w/ validity) · Ebooks (schema §5 + `/ebooks` + ebook_manager screens: add/manage/categories/payment history) · Tutor booking (schema §5 + `/tutors` browse/filter, schedules, booking + `my_bookings`) · Affiliate program (referral code, commission %, withdrawal via Payout) · SCORM/H5P (v2: file import + SCORM Cloud embed) · Bootcamp & team training (v2: cohort scheduling) · Customer support addon (v2: ticketing).

---

## 8. Settings inventory (seed from legacy; full list in `settings` + `frontend_settings` tables)

**System:** system_name, system_title, system_email, address, phone, timezone, language (default), language_dirs (enabled), server_protocol, video_upload_location, allowed_device_number_of_loging, account_disable, student_email_verification, purchase_code, version, page_about/about_us, motivational_speech, faq_section/website_faqs, latest_course_section, top_category_section, top_course_section, top_instructor_section, upcoming_course_section, promotional_section, course_accessibility, course_selling_tax, instructor_revenue (%), allow_instructor, instructor_application_note, instructors_blog_permission, iso_country_codes, watermark_{status,color,opacity,speed}, drip_content_settings (JSON), google_analytics_id, meta_pixel_id, embed_code, custom_css, cookie_{status,note,policy}, affiliate_{addon_active_status,addon_percentage}, openai (api_key, model).
**Branding:** light_logo, dark_logo, small_logo, favicon, banner_image, banner_title, banner_sub_title.
**SMTP:** smtp_host, smtp_port, smtp_user, smtp_pass, smtp_crypto, smtp_from_email.
**Socials:** facebook, twitter, linkedin, author, contact_info, footer_text, footer_link, privacy_policy, terms_and_condition, refund_policy, website_description, website_keywords.
**Payments:** system_currency, currency_position, paypal{keys,currency}, stripe_keys{secret,publishable}, razorpay{key,secret}, + regional gateways (per GatewayConfig), payment_gateways.enabled flags.
**Storage/video:** amazon_s3_{access,secret,bucket,region}, wasabi_{key,secret,bucketname,region}, vimeo_api_key, youtube_api_key, zoom_{api_key,secret}, bbb (server url+secret), academy_cloud_access_token (drop), stream/mux tokens (new).
**Frontend extras:** blog_visibility_on_the_home_page, blog_page_{title,subtitle,banner}, seo defaults, sitemap settings, theme.

---

## 9. Data migration (MySQL → Postgres) — `scripts/migrate/*`

1. **Extract** with `mysql2` from a live-DB dump: run one script per domain in dependency order (users → categories → courses → pricing → instructors join → sections → lessons → quizzes → enrollments → payments → progress → reviews → messages → notifications → blog → settings → home pages → custom fields/pages/SEO → certificates → forum → bundles/ebooks/tutors).
2. **Transform** rules: decimal→minor units; `course.user_id` CSV → `CourseInstructor` (first = owner/`isOwner`); `users.wishlist` CSV → `WishlistItem`; `watch_histories.completed_lesson` JSON array → `LessonProgress(isCompleted)`; `enrol.expiry_date` → `expiresAt`; status maps (`0/1/draft/pending/active`); `blogs` → `Post` (author role decides default status); `settings` keys → domain `Setting` values (Zod-validated; unknown keys → `Setting("legacy."+key)`); payment gateway `keys` → encrypted `GatewayConfig.keys`; slugs recomputed via §3.1 and stored w/ `legacyId` for redirects; content HTML passed through sanitizer.
3. **Passwords:** keep `legacyPassword = sha1` value; on login, if `passwordHash` empty and `sha1(input) === legacyPassword` → set bcrypt hash, clear legacy field. If verification email matters, force reset.
4. **Media:** sync `uploads/` → S3/R2 with same folder names; rewrite DB URLs (`base_url()/uploads/...` → storage base) in a post-pass; thumbnails regenerated where missing (`resizeImage` parity).
5. **Validate:** row-count diff per table, orphan checks, 20 random users' journey spot-checks, JSON parse report (quarantine table for failures).
6. **Redirects:** generate `/redirects` map for the §6 patterns; load via `next.config` + DB fallback route.
7. **Cutover rehearsal** on staging → freeze legacy writes → final ETL → smoke suite (§10) → DNS.

---

## 10. Build order & milestones (each ends in a demoable, tested increment)

| # | Milestone | Includes (§ refs) | E2E gate |
|---|---|---|---|
| M0 | Scaffold & foundation | repo, CI, Prisma §5, Better Auth, settings service, storage lib, i18n seed, design tokens, admin shell | auth flows pass |
| M1 | Catalog & public site | §7.2–7.4, §7.14 (SEO/i18n/currency), custom pages, blog | course page Lighthouse ≥ 90; search/filters |

> **M1 STATUS (2026-09-03):** ✅ COMPLETE. Catalog, course pages, instructor pages, blog (list + article + comments), custom pages `/p/[url]`, sitemap.xml + robots.txt, 404, newsletter subscribe action, free enrollment, working auth. Design system: "Editorial Academy" (Fraunces display serif, paper/ink/coral/sun tokens, grain texture) applied across all surfaces. i18n dictionaries not yet wired into routing (next-intl `[locale]` pass deferred to the platform phase — dictionaries exist at `../Academy-LMS/languages/*.json`, 1,088 phrases × 16 locales).

> **M2 STATUS (2026-09-03):** ✅ CORE SHIPPED, verified live against Neon Postgres. Dashboard shell with auth guard (307 → /sign-in), overview (greeting, stats, continue-learning), my-courses with progress bars, wishlist (table + heart toggle on course pages), purchases/access history, notifications (seeded + mark-all-read + header bell w/ unread badge), messages (thread list + conversation + reply), profile editor, forgot-password page. Dev DB is now the user's Neon instance (`DATABASE_URL` in `.env`); local Docker Postgres retained as fallback. Still open in M2: email verification UX, reset-password completion page, account-disable UI polish.

> **M3 STATUS (2026-09-03):** ✅ SHIPPED, verified live on Neon. Learn shell at `/learn/[courseId]/[lessonId]` with resume redirect (`/learn/[courseId]` → watching lesson), curriculum sidebar with completion ticks + drip locks, bottom tabs (summary/attachments/certificate). Native `<video>` player for HTML5 lessons with **5s heartbeat → resume position → auto-complete at ≥90%** (`saveProgressSeconds`); YouTube/Vimeo iframe embeds with manual completion. Quiz engine: legacy-parity **sorted-array exact-match grading** (§3.2), attempt cap enforced, results stored in legacy JSON shape. Progress recompute (§3.3) on every completion; **certificate auto-issued at 100%** with human-readable code `AC-XXXXX-XXXXX`, public verify page `/certificate/[code]` with print/PDF styling. Gates verified live: expired enrollment → redirect to course page (§3.5); drip rules render "Unlocks September 5" / "Finish the previous section first". Seed includes HTML5 sample videos (Google gtv bucket), "Learning How to Learn" drip course (daysAfterEnroll + prevSection rules), and an expired enrollment demo. Open in M3: per-question partial scoring option, lesson Q&A tab (forum, M7), live-class tab (M7).
| M2 | Student core | §7.1 rest, dashboard pages, messages, notifications, wishlist | profile/wishlist E2E |
| M3 | Learning | §7.6–7.7 + §7.10 certificates | learn→complete→certificate E2E |
| M4 | Commerce | §7.5 Stripe/PayPal/Razorpay + offline + coupons/gift/tax/invoices | buy→enroll webhook E2E |
| M5 | Instructor studio | §7.8 incl. builder + sales/payouts | create→submit→approve E2E |
| M6 | Admin suite | §7.9 + language manager + newsletters + builder admin | permission matrix tests |
| M7 | Platform | §7.11–7.18: live classes, forum, badges, AI, media/backup, mobile `/api/v1` + webviews | legacy-app contract tests |
| M8 | Migration & launch | §9 ETL, redirects, staging rehearsal, smoke suite | row-count + journey diff clean |

> **M4–M8 STATUS (2026-09-03): ALL MILESTONES SHIPPED & VERIFIED.**
> **M4 Commerce** — cart (DB-backed), coupon engine (§3.9 math verified: $19.99 course + 10% coupon → $18.00), gifting, tax, order/fulfillment service with idempotent replay, **revenue split verified 70/30** (setting-driven), invoices (printable), offline-transfer approval flow, **Sandbox Bank mock gateway** for full checkout demos without keys; Stripe/PayPal/Razorpay adapters are env-key-activated (route stubs + GatewayConfig registry seeded). `scripts/test-purchase.ts` = repeatable E2E money test.
> **M5 Studio** — instructor guard with application flow, course wizard + edit forms, curriculum manager (sections/lessons/quiz builder), sales report, payout withdrawals, instructor blog (auto-pending), all pages live.
> **M6 Admin** — guard (role=admin), dashboard stats + manual enrollment, course moderation (approve/unpublish + notifications), users (instructor/disable toggles + applications review), commerce (orders, offline approvals, payouts mark-paid, coupons CRUD), content (reviews, pending posts, custom pages, subscribers, home-page section editor, platform settings).
> **M7 Platform** — `/api/v1` mobile API with **legacy JWT parity** (HS256 `academy-lms-api-token-handler`, `user_id` payload; login/catalog/course-object/progress endpoints all verified live, incl. percent recompute), `/api/cron` (secret-guarded, expiring-enrollment notifications), live classes (Jitsi auto-rooms + Zoom/BBB/external, studio scheduling + course-page section), AI studio assistant (OpenAI, graceful without key).
> **M8 Migration** — `scripts/migrate/etl.ts` (MySQL→Postgres: users w/ `legacy-sha1:` bridge, categories, courses + comma-ID→join-table conversion, decimal→minor-units; remaining domains follow the established pattern), **legacy URL redirects** verified live (`/home/course/{slug}/{id}` → 308 → `/course/{slug}-{id}`), SHA-1 verify bridge in Better Auth (transparent re-hash on first login).
> **PARITY COMPLETION PASS (2026-09-03): every remaining gap from the final parity review is closed and verified live.**
> New: `/about`, `/faq`, `/contact` (+ admin inbox in Content), 4 policy pages, cookie consent banner · `/compare` 3-way comparison table · instructor follow (button + follower counts + `/dashboard/following`) · badges engine (`evaluateBadges` hooked into lesson completion / quiz acing / enrollment, 5 seeded badges, `/dashboard/badges` with progress bars) · course Q&A forum in the player (ask/reply/upvote, enrolled-only, legacy forum addon) · **strict quiz countdown timer** (`quizzes.time_limit_minutes`, red-under-60s, auto-submit; editor in the studio quiz builder) · **i18n EN/ES** (next-intl cookie strategy — no route restructure; header language switcher; hero/nav/auth/footer/errors/cookie-banner translated) · **dark mode** (next-themes + PreferencesMenu: Light/Dark/System) · newsletter campaigns (compose → send → stats; delivery hook for Resend/SMTP in `sendCampaign`) · admin categories CRUD (tree with rename/delete guards) · contact inbox (read states).

**Final route count: 48 pages + 6 API routes.** Build green; all new surfaces smoke-tested. Remaining externals only: real gateway keys, ETL run against the legacy dump, `uploads/` → S3 sync.

Suggested effort: M0 1–2w · M1 2–3w · M2 1–2w · M3 3w · M4 2–3w · M5 3w · M6 3–4w · M7 2–3w · M8 1–2w.

---

## 11. Definition of done (per feature)
Zod-validated inputs · RBAC enforced · unit tests for services (quiz grading, pricing math, progress, coupon) · Playwright path · empty/loading/error states · mobile responsive · i18n keys (en) · SEO metadata · no console errors · a11y labels · typed API responses · seed data updated · docs table updated in this file's §6 map.

## 12. Appendices

**12.1 Payment gateways (legacy evidence → new adapter file)**
PayPal (`Payment_model::check_paypal_payment`, `Home::paypal_*`) → `payments/paypal.ts` · Stripe (`check_stripe_payment`, `create_stripe_payment`) → `payments/stripe.ts` · Razorpay (`check_razorpay_payment`, `razorpayPrepareData`) → `payments/razorpay.ts` · PayU (`check_payu_payment`, `create_payu_payment`) · SSLCOMMERZ (`check_sslcommerz_payment`) · Xendit (`check_xendit_payment`) · Doku (`check_doku_payment`, `doku_ipn`) · Cashfree (`pay_by_cashfree`) · Maxicash (`create_maxicash_payment`) · AamarPay (`aamarpay_payment_link`) · TazaPay (`tazapay_payment_form`) · Skrill (`check_skrill_payment`) · PagSeguro (`check_pagseguro_payment`) · Paystack (`libraries/Paystack.php`) · Offline (addon) → all implement `GatewayAdapter` in `src/lib/payments/regional.ts`.

**12.2 Lesson-type forms (parity with admin views)**
video: {provider: html5/upload | youtube | vimeo | iframe | external-url | s3 | wasabi | google_drive | stream} + duration probe + caption (.vtt) + summary · audio · document (pdf/image/attachment download) · text (rich HTML) · quiz (attempts, timer).

**12.3 Question types** — multiple_choice (multi-select checkboxes), single_choice (radio; true/false = 2 options), fill_in_the_blank (typed input matched case-insensitively against `correct_answers`). Options may carry images (legacy `image` usage).

**12.4 Notification/email events (from `Email_model.php`)** — email verification · course status change (approved/denied/suspended/pending) · course purchase (to instructor+admin) · certificate generated · offline payment suspend/notice · bundle purchase · gift notification (to recipient + enrollee) · become-affiliate/approve/delete/suspend/reactivate (affiliate) · withdrawal requested (instructor + admin) · withdrawal approved/cancelled · instructor follow-up reminders. Each = `NotificationTemplate` seeded with legacy subject/template text.

**12.5 i18n** — 16 locales: english, arabic, chinese, french, georgian, german, hindi, indonesia, italian, khmer, portuguese, romanian, russian, spanish, turkish, urdu. 1,088 English phrases; keys = English source strings (§3.12). RTL: arabic, urdu.

**12.6 Sources of truth for screens** — when unsure how a screen looks/behaves, open the exact legacy view file (§1.4) and the matching controller method, then rebuild with shadcn/Tailwind to the same information architecture.

> **THEME & STRUCTURE PARITY PASS (2026-09-03):** homepage restructured to mirror legacy `home_1.php` — centered banner hero with big "What do you want to learn" search, then Top courses → Top categories → Expert instructors → Testimonials ("What the people think about us") → FAQ preview → Latest blogs → Become-an-instructor CTA ("Start now"). Palette retokened to the legacy theme: primary `#754ffe` purple, slate `#1e293b` text, orange `#fe954f` highlight, cool-gray surfaces; display font switched Fraunces → **Outfit** (legacy typeface). Header gained the legacy Courses categories dropdown. Section order is DB-driven and editable in the admin page builder.

> **M8 EXECUTED & PROVEN (2026-09-03):** the migration path now runs end-to-end against the real dump.
> - `scripts/migrate/legacy-schema.json` — all 46 legacy tables parsed from `uploads/install.sql` (columns + types).
> - `scripts/migrate/etl.ts` — **complete ETL**: MySQL (mysql2) → Neon Postgres **via Drizzle only**. Covers every legacy domain: users+sha1 accounts, categories, courses (+CSV owners→join, custom fields, meta), sections/lessons/quizzes/questions (index→string answers), enrollments, coupons/gateways/payments→orders+split, reviews, course-comments→forum, watch histories→progress, quiz results, applications/followings/messages, blog, contact, custom pages, SEO, BBB→live classes, payouts, newsletters, notifications, settings (system/frontend/notificationTemplates + full `legacy.*` bucket). Skipped w/ warnings: role/permissions, language phrases, addons, log, ci_sessions, tag, currency.
> - Verified live: MySQL 8 container (`academy-mysql`, port 3307, db `academy_legacy`) loaded from `install.sql` + a realistic fixture exercising every format quirk → ETL → Neon `academy_mig`. **Zero orphans; all transforms spot-checked:** 49.99→4999¢, correct `[1]`→`["let"]`, revenue split 899/2100 preserved, progress recomputed 2/4=50%, `legacy-sha1:` bridge matches (login re-hash ready), settings domains populated.
> - Production cutover recipe: restore your real dump into the MySQL container → `DATABASE_URL=<fresh neon db> LEGACY_DB_URL=… npx tsx scripts/migrate/etl.ts --wipe` → review warnings → point the app at that DB. Sync `uploads/` to S3 and rebase URLs after.

> **UI/UX DEEP PASS (2026-09-03, round 2):** legacy course-page overview video now renders inline (legacy `course_page_preview_modal` parity) via a new `previewMode` on the shared player — no progress tracking, preview caption; gradient fallback when a course has no promo. Quiz runner redesigned: option rows are selectable cards with primary-border states, an answered-count progress bar, and a score banner (ring + pass/fail copy) on results. Sign-in/sign-up gained Google/Facebook social buttons (legacy social-login parity, graceful error when keys absent) with an email divider. Seed now includes promo videos, gateway registry, coupons and the BBB/live-class demo row; seed wipe covers the new tables.

> **PRE-PRODUCTION COMPONENT SWEEP (2026-09-03, final):** course-page curriculum upgraded from native `<details>` to shadcn Accordion (animated, chevron state, per-section lesson counts + total minutes, lucide type icons replacing emoji, Preview badges, durations). CourseCard hover: lift + elevated shadow. Auth forms: password show/hide via shadcn InputGroup on sign-in/sign-up/confirm fields. All type-checked, build green, verified live.

> **UPLOADS SHIPPED (2026-09-03):** full media pipeline for the course builder — `src/lib/storage.ts` (LOCAL driver: `./uploads/` git-ignored, per-bucket size/MIME guards; S3/R2 branch stub) · `POST /api/upload` (auth: instructors for course media, students only avatars) · `GET /api/files/[...path]` streaming route (traversal-safe, immutable cache, range-ready) · wired into the studio: lesson **video upload** (auto-sets html5 provider + progress tracking), **document/attachment upload**, **course thumbnail** in media settings, and **profile avatar** (updates session user). `.env.example` completed with every key the app reads (auth, socials, payments, OpenAI, storage, cron, email).

> **CERTIFICATE PDF (2026-09-03):** legacy html2canvas flow upgraded — `GET /api/certificate/[code]/pdf` (@react-pdf/renderer, node runtime) generates a true vector A4-landscape diploma (purple double border, name in italic, VERIFIED seal, credential ID + issue date, verify URL footer). Download button on the verify page; demo certificate `AC-DEMO1-TEST1` is now part of the seed so it survives reseeds. Verified: 200 + `application/pdf` + valid `%PDF` header + 404 for unknown codes.

> **FINAL PARITY HARDENING (2026-09-03):** the last three legacy gaps closed — **(1) Granular admin permissions**: `admin_permissions` table (per-admin JSON flags), `requireAdmin(section)` guards on every admin action, admin nav filtered by flags, checkbox editor on /admin/users (self-edit blocked); default-open, verified nav filtering E2E. **(2) CSV exports**: `/api/admin/export/{enrollments,students,orders}` — admin-only, section-scoped, verified with real data + 403 anon. **(3) Per-route SEO consumption**: `getSeoForRoute()` reads `seo_meta` in generateMetadata for home/courses/blog (legacy get_seo_by_route parity) — ETL-mapped legacy SEO rows now render. All three verified live; build green.

> **MOBILE PASS (2026-09-03):** all pages audited for ≤390px viewports and fixed — (1) dashboard/studio/admin sidebars render as horizontally-scrollable pill chips on mobile (notebook style on ≥lg); (2) course filter bar stacks full-width selects on mobile; (3) header hides Sign in/Sign up buttons below `sm` with auth links added to the mobile Sheet menu; (4) newsletter form stacks; (5) admin manual-enroll inputs shrink; (6) loading skeletons capped with max-w-full/wrap. Player already stacks content-first (`order-1`), compare table has overflow-x, promo video is aspect-video. Verified: 7-route sweep clean, build green.

> **PRODUCTION ERROR FIX (2026-09-03):** decoded user-reported `Base UI error #31` → base-ui source: `MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>`. Root cause: shadcn base-nova's `DropdownMenuLabel` renders `Menu.GroupLabel`, which requires `Menu.Group` context — the header user menu, courses menu and preferences menu rendered labels directly under `DropdownMenuContent`. Fixed by wrapping label+items in `DropdownMenuGroup` (header ×2, preferences ×2). The secondary `M_ID` TypeError was a crash cascade of the same error. Users should hard-refresh (chunk hashes change). Verified: build green, SSR 200s clean.

> **SUBSCRIPTION PLANS (2026-09-03 — NEW, beyond legacy):** all-access memberships added. Schema: `plans` (name/price/interval/features/active) + `subscriptions` (unique per user+plan, status active/canceled, currentPeriodEnd, sandbox gateway). **Access gate**: `getLearnAccess` auto-enrolls subscription holders into any course on first visit (source `subscription`, new enum value). Surfaces: public **/pricing** (DB-driven plan cards, Most-popular highlight, subscribe via Sandbox gateway), user **/dashboard/subscription** (status, renewal date, cancel/re-activate — canceled keeps access until period end), admin **/admin/plans** (create/edit/deactivate/delete with subscriber guard). Wired: dashboard nav 06, admin nav 06, header/footer Pricing links, EN/ES i18n. Stripe subscriptions plug into `subscribeToPlan` later. Seeded: Starter $9/mo, Pro $19/mo (featured), All-Access Yearly $199/yr; Maria holds Pro.
