ALTER TABLE "enrollments" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "likes" integer DEFAULT 0 NOT NULL;