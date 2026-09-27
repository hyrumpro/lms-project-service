import "dotenv/config";
import postgres from "postgres";

const connection = process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL is not set");

const sql = postgres(connection, { prepare: false });

const statements = [
  "ALTER TYPE lesson_type ADD VALUE IF NOT EXISTS 'image'",
  "ALTER TYPE enrollment_source ADD VALUE IF NOT EXISTS 'bundle'",
  "ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate_quiz_threshold integer",
  "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS drip_day integer NOT NULL DEFAULT 0",
  "ALTER TABLE course_progress ADD COLUMN IF NOT EXISTS drip_unlocked_order integer NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_code text",
  "ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0",
  "ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false",
  `CREATE TABLE IF NOT EXISTS bundles (
    id text PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    price integer NOT NULL DEFAULT 0,
    summary text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS bundle_courses (
    bundle_id text NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE (bundle_id, course_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ebooks (
    id text PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    price integer NOT NULL DEFAULT 0,
    summary text,
    file_url text,
    category text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ebook_purchases (
    id text PRIMARY KEY,
    ebook_id text NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ebook_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tutors (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    subject text NOT NULL,
    hourly_rate integer NOT NULL DEFAULT 0,
    bio text
  )`,
  `CREATE TABLE IF NOT EXISTS tutor_slots (
    id text PRIMARY KEY,
    tutor_id text NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id text PRIMARY KEY,
    slot_id text NOT NULL REFERENCES tutor_slots(id) ON DELETE CASCADE,
    student_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS affiliates (
    user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    commission_percent integer NOT NULL DEFAULT 10
  )`,
  `CREATE TABLE IF NOT EXISTS campaign_sends (
    id text PRIMARY KEY,
    campaign_id text NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    email text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

async function main() {
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
  console.log("additive schema applied");
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
