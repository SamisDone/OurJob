/**
 * Data model. Source of truth: docs/ARCHITECTURE.md section 3.
 * Every table has id, created_at and updated_at. Per-user tables carry
 * user_id even though each deployment has one owner.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AtsReport, Attribution, PipelineStats, RemoteScope, Salary, ValidatorReport } from "@/lib/jobs/types";
import type { JobSpec, MasterProfile, SearchPreferences, TailoredResume } from "@/lib/profile/schema";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

const base = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: tz("created_at").notNull().defaultNow(),
  updatedAt: tz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* Enums -------------------------------------------------------------------- */

export const profileSourceKind = pgEnum("profile_source_kind", [
  "cv_tex",
  "cv_pdf",
  "cv_docx",
  "cv_md",
  "linkedin_pdf",
  "github",
  "portfolio",
  "notes",
]);

export const discoveredVia = pgEnum("discovered_via", [
  "board_apply_link",
  "hn",
  "remoteintech",
  "seed",
  "manual",
  "aggregator",
]);

export const workplace = pgEnum("workplace", ["remote", "hybrid", "onsite", "unknown"]);
export const postedAtSource = pgEnum("posted_at_source", ["source_field", "jsonld", "first_seen", "unknown"]);
export const eligibility = pgEnum("eligibility", ["eligible", "unclear", "ineligible"]);
export const matchStatus = pgEnum("match_status", [
  "new",
  "seen",
  "saved",
  "dismissed",
  "applied",
  "interviewing",
  "offer",
  "closed",
]);
export const runTrigger = pgEnum("run_trigger", ["schedule", "manual"]);
export const runStatus = pgEnum("run_status", ["running", "succeeded", "partial", "failed"]);

/* Tables ------------------------------------------------------------------- */

export const users = pgTable("users", {
  ...base,
  email: text("email").notNull().unique(),
  name: text("name"),
  /** Name used for greetings in the app; can differ from the CV name. */
  displayName: text("display_name"),
  image: text("image"),
  timezone: text("timezone"),
  country: varchar("country", { length: 2 }),
});

export const profileSources = pgTable(
  "profile_sources",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: profileSourceKind("kind").notNull(),
    originalFilename: text("original_filename"),
    /** Max 5 MB, enforced on upload. */
    fileBytes: bytea("file_bytes"),
    extractedText: text("extracted_text"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    fetchedAt: tz("fetched_at"),
  },
  (t) => [index("profile_sources_user_idx").on(t.userId)],
);

export const masterProfiles = pgTable(
  "master_profiles",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").$type<MasterProfile>().notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    confirmedAt: tz("confirmed_at"),
  },
  (t) => [
    uniqueIndex("master_profiles_user_version_uq").on(t.userId, t.version),
    uniqueIndex("master_profiles_one_current_uq")
      .on(t.userId)
      .where(sql`${t.isCurrent}`),
  ],
);

export const searchPreferences = pgTable("search_preferences", {
  ...base,
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<SearchPreferences>().notNull(),
});

export const companies = pgTable(
  "companies",
  {
    ...base,
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
    website: text("website"),
    careersUrl: text("careers_url"),
    atsType: text("ats_type"),
    atsSlug: text("ats_slug"),
    atsVerified: boolean("ats_verified").notNull().default(false),
    discoveredVia: discoveredVia("discovered_via").notNull(),
    isStaffingAgency: boolean("is_staffing_agency").notNull().default(false),
    isWellKnown: boolean("is_well_known").notNull().default(false),
    muted: boolean("muted").notNull().default(false),
    openRolesCount: integer("open_roles_count"),
    lastCrawledAt: tz("last_crawled_at"),
    crawlCount: integer("crawl_count").notNull().default(0),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    paused: boolean("paused").notNull().default(false),
  },
  (t) => [uniqueIndex("companies_ats_uq").on(t.atsType, t.atsSlug)],
);

export const jobs = pgTable(
  "jobs",
  {
    ...base,
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    tier: smallint("tier").notNull(),
    sourceJobId: text("source_job_id").notNull(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    descriptionHtml: text("description_html").notNull().default(""),
    descriptionText: text("description_text").notNull().default(""),
    applyUrl: text("apply_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    locationRaw: text("location_raw").notNull().default(""),
    workplace: workplace("workplace").notNull().default("unknown"),
    remoteScope: jsonb("remote_scope").$type<RemoteScope>(),
    employmentType: text("employment_type"),
    salary: jsonb("salary").$type<Salary>(),
    postedAt: tz("posted_at"),
    postedAtSource: postedAtSource("posted_at_source").notNull().default("unknown"),
    firstSeenAt: tz("first_seen_at").notNull().defaultNow(),
    lastSeenAt: tz("last_seen_at").notNull().defaultNow(),
    closedAt: tz("closed_at"),
    attribution: jsonb("attribution").$type<Attribution>(),
    alsoSeenIn: jsonb("also_seen_in").$type<{ source: string; url: string }[]>().notNull().default([]),
    contentHash: text("content_hash").notNull(),
  },
  (t) => [
    uniqueIndex("jobs_source_uq").on(t.source, t.sourceJobId),
    index("jobs_posted_at_idx").on(t.postedAt),
    index("jobs_canonical_url_idx").on(t.canonicalUrl),
    index("jobs_company_idx").on(t.companyId),
  ],
);

export const jobMatches = pgTable(
  "job_matches",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    prefilterScore: real("prefilter_score"),
    fitScore: smallint("fit_score"),
    fitReasons: jsonb("fit_reasons").$type<string[]>().notNull().default([]),
    gaps: jsonb("gaps").$type<string[]>().notNull().default([]),
    eligibility: eligibility("eligibility").notNull().default("unclear"),
    status: matchStatus("status").notNull().default("new"),
    /** When status last changed; the tracker shows it as "date moved". */
    statusChangedAt: tz("status_changed_at"),
    notes: text("notes"),
    scoredAt: tz("scored_at"),
    model: text("model"),
  },
  (t) => [
    uniqueIndex("job_matches_user_job_uq").on(t.userId, t.jobId),
    index("job_matches_user_status_idx").on(t.userId, t.status),
  ],
);

export const tailorings = pgTable(
  "tailorings",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    jdRaw: text("jd_raw").notNull(),
    jdClean: text("jd_clean").notNull(),
    jobSpec: jsonb("job_spec").$type<JobSpec>(),
    tailored: jsonb("tailored").$type<TailoredResume>(),
    validatorReport: jsonb("validator_report").$type<ValidatorReport>(),
    latex: text("latex"),
    atsMaster: jsonb("ats_master").$type<AtsReport>(),
    atsTailored: jsonb("ats_tailored").$type<AtsReport>(),
    options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
    profileVersion: integer("profile_version"),
  },
  (t) => [index("tailorings_user_created_idx").on(t.userId, t.createdAt)],
);

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    ...base,
    startedAt: tz("started_at").notNull().defaultNow(),
    finishedAt: tz("finished_at"),
    trigger: runTrigger("trigger").notNull(),
    stats: jsonb("stats").$type<PipelineStats>(),
    errors: jsonb("errors").$type<{ source?: string; company?: string; message: string }[]>().notNull().default([]),
    status: runStatus("status").notNull().default("running"),
  },
  (t) => [index("pipeline_runs_started_idx").on(t.startedAt)],
);

export const llmCache = pgTable("llm_cache", {
  ...base,
  /** Hash of prompt id + prompt version + model + input. */
  key: text("key").notNull().unique(),
  output: jsonb("output").notNull(),
});
