CREATE TYPE "public"."discovered_via" AS ENUM('board_apply_link', 'hn', 'remoteintech', 'seed', 'manual', 'aggregator');--> statement-breakpoint
CREATE TYPE "public"."eligibility" AS ENUM('eligible', 'unclear', 'ineligible');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('new', 'seen', 'saved', 'dismissed', 'applied', 'interviewing', 'offer', 'closed');--> statement-breakpoint
CREATE TYPE "public"."posted_at_source" AS ENUM('source_field', 'jsonld', 'first_seen', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."profile_source_kind" AS ENUM('cv_tex', 'cv_pdf', 'cv_docx', 'cv_md', 'linkedin_pdf', 'github', 'portfolio', 'notes');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('schedule', 'manual');--> statement-breakpoint
CREATE TYPE "public"."workplace" AS ENUM('remote', 'hybrid', 'onsite', 'unknown');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"website" text,
	"careers_url" text,
	"ats_type" text,
	"ats_slug" text,
	"ats_verified" boolean DEFAULT false NOT NULL,
	"discovered_via" "discovered_via" NOT NULL,
	"is_staffing_agency" boolean DEFAULT false NOT NULL,
	"is_well_known" boolean DEFAULT false NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"open_roles_count" integer,
	"last_crawled_at" timestamp with time zone,
	"crawl_count" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	CONSTRAINT "companies_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"prefilter_score" real,
	"fit_score" smallint,
	"fit_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"eligibility" "eligibility" DEFAULT 'unclear' NOT NULL,
	"status" "match_status" DEFAULT 'new' NOT NULL,
	"status_changed_at" timestamp with time zone,
	"notes" text,
	"scored_at" timestamp with time zone,
	"model" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company_id" uuid NOT NULL,
	"source" text NOT NULL,
	"tier" smallint NOT NULL,
	"source_job_id" text NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"description_html" text DEFAULT '' NOT NULL,
	"description_text" text DEFAULT '' NOT NULL,
	"apply_url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"location_raw" text DEFAULT '' NOT NULL,
	"workplace" "workplace" DEFAULT 'unknown' NOT NULL,
	"remote_scope" jsonb,
	"employment_type" text,
	"salary" jsonb,
	"posted_at" timestamp with time zone,
	"posted_at_source" "posted_at_source" DEFAULT 'unknown' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"attribution" jsonb,
	"also_seen_in" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"output" jsonb NOT NULL,
	CONSTRAINT "llm_cache_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "master_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" "run_trigger" NOT NULL,
	"stats" jsonb,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "profile_source_kind" NOT NULL,
	"original_filename" text,
	"file_bytes" "bytea",
	"extracted_text" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "search_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "search_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tailorings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"jd_raw" text NOT NULL,
	"jd_clean" text NOT NULL,
	"job_spec" jsonb,
	"tailored" jsonb,
	"validator_report" jsonb,
	"latex" text,
	"ats_master" jsonb,
	"ats_tailored" jsonb,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_version" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"display_name" text,
	"image" text,
	"timezone" text,
	"country" varchar(2),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_profiles" ADD CONSTRAINT "master_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_sources" ADD CONSTRAINT "profile_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_preferences" ADD CONSTRAINT "search_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailorings" ADD CONSTRAINT "tailorings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailorings" ADD CONSTRAINT "tailorings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_ats_uq" ON "companies" USING btree ("ats_type","ats_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "job_matches_user_job_uq" ON "job_matches" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "job_matches_user_status_idx" ON "job_matches" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_uq" ON "jobs" USING btree ("source","source_job_id");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "jobs_canonical_url_idx" ON "jobs" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "master_profiles_user_version_uq" ON "master_profiles" USING btree ("user_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "master_profiles_one_current_uq" ON "master_profiles" USING btree ("user_id") WHERE "master_profiles"."is_current";--> statement-breakpoint
CREATE INDEX "pipeline_runs_started_idx" ON "pipeline_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "profile_sources_user_idx" ON "profile_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tailorings_user_created_idx" ON "tailorings" USING btree ("user_id","created_at");