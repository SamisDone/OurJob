import { z } from "zod";

/** Shapes from docs/AI_PROMPTS.md. Every list item has a stable id that tailoring refers to. */

export const sourceTag = z.enum(["cv", "linkedin", "github", "portfolio", "notes", "user_added"]);
export type SourceTag = z.infer<typeof sourceTag>;

export const bulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  boldPhrases: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  metrics: z.array(z.object({ value: z.string(), hedge: z.string().optional() })).default([]),
  sources: z.array(sourceTag),
});
export type Bullet = z.infer<typeof bulletSchema>;

const sourced = { sources: z.array(sourceTag) };

export const skillCategory = z.enum([
  "language",
  "framework",
  "library",
  "database",
  "cloud",
  "tool",
  "practice",
  "domain",
  "soft",
]);

export const masterProfileSchema = z.object({
  basics: z.object({
    name: z.string(),
    headline: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.object({ id: z.string(), label: z.string(), url: z.string() })).default([]),
    summary: z.object({ id: z.string(), text: z.string(), ...sourced }).optional(),
  }),
  experience: z.array(
    z.object({
      id: z.string(),
      company: z.string(),
      companyUrl: z.string().optional(),
      title: z.string(),
      location: z.string().optional(),
      employmentType: z.string().optional(),
      start: z.string(), // "YYYY-MM" or "YYYY"
      end: z.string(), // "YYYY-MM", "YYYY" or "present"
      bullets: z.array(bulletSchema),
      tech: z.array(z.string()).default([]),
      ...sourced,
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      liveUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
      role: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      description: z.string(),
      bullets: z.array(bulletSchema),
      tech: z.array(z.string()).default([]),
      ...sourced,
    }),
  ),
  education: z.array(
    z.object({
      id: z.string(),
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      location: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      grade: z.string().optional(),
      highlights: z.array(z.object({ id: z.string(), text: z.string(), ...sourced })).default([]),
      ...sourced,
    }),
  ),
  skills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      aliases: z.array(z.string()).default([]),
      category: skillCategory,
      evidence: z.array(z.string()).default([]),
      ...sourced,
    }),
  ),
  certifications: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        issuer: z.string().optional(),
        date: z.string().optional(),
        url: z.string().optional(),
        ...sourced,
      }),
    )
    .default([]),
  awards: z.array(z.object({ id: z.string(), text: z.string(), date: z.string().optional(), ...sourced })).default([]),
  languages: z
    .array(z.object({ id: z.string(), name: z.string(), level: z.string().optional(), ...sourced }))
    .default([]),
  publications: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        venue: z.string().optional(),
        date: z.string().optional(),
        url: z.string().optional(),
        ...sourced,
      }),
    )
    .default([]),
  /** Any other CV section, under its own heading as written: Leadership, Volunteering, Activities. */
  extraSections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        items: z.array(z.object({ id: z.string(), text: z.string(), ...sourced })),
      }),
    )
    .default([]),
  /** CV text that no part of the profile holds, found in code after extraction. Shown to him, never dropped. */
  unplaced: z.array(z.object({ id: z.string(), heading: z.string(), text: z.string() })).default([]),
  conflicts: z
    .array(z.object({ field: z.string(), values: z.array(z.object({ value: z.string(), source: sourceTag })) }))
    .default([]),
});
export type MasterProfile = z.infer<typeof masterProfileSchema>;

/* P2 ----------------------------------------------------------------------- */

export const seniority = z.enum(["intern", "junior", "mid", "senior", "staff", "lead", "unknown"]);
export type Seniority = z.infer<typeof seniority>;

export const jobSpecSchema = z.object({
  title: z.string(),
  company: z.string().optional(),
  seniority: seniority.optional(),
  employmentType: z.string().optional(),
  location: z.string().optional(),
  remoteScopeText: z.string().optional(),
  salaryText: z.string().optional(),
  yearsExperience: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  responsibilities: z.array(z.string()),
  keywords: z.array(
    z.object({
      term: z.string(),
      canonical: z.string(),
      synonyms: z.array(z.string()),
      importance: z.enum(["must", "nice"]),
      kind: z.enum(["hard_skill", "tool", "domain", "certification", "soft_skill", "title"]),
      evidenceQuote: z.string(),
    }),
  ),
});
export type JobSpec = z.infer<typeof jobSpecSchema>;

/* P3 ----------------------------------------------------------------------- */

export const tailoredBulletSchema = z.object({
  text: z.string(),
  boldPhrases: z.array(z.string()),
  sourceIds: z.array(z.string()),
  keywordsUsed: z.array(z.string()),
});
export type TailoredBullet = z.infer<typeof tailoredBulletSchema>;

export const cvSectionId = z.enum([
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
  "awards",
]);

export const tailoredResumeSchema = z.object({
  headline: z.string(),
  summary: z.object({ text: z.string(), sourceIds: z.array(z.string()) }).optional(),
  sections: z.array(cvSectionId),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.object({ name: z.string(), skillId: z.string() })) })),
  experience: z.array(
    z.object({ experienceId: z.string(), bullets: z.array(tailoredBulletSchema), tech: z.array(z.string()) }),
  ),
  projects: z.array(
    z.object({ projectId: z.string(), bullets: z.array(tailoredBulletSchema), tech: z.array(z.string()) }),
  ),
  educationIds: z.array(z.string()),
  certificationIds: z.array(z.string()),
  awardIds: z.array(z.string()),
  notes: z.array(z.string()),
});
export type TailoredResume = z.infer<typeof tailoredResumeSchema>;

/* Search preferences (PRD F2) ------------------------------------------------ */

export const searchPreferencesSchema = z.object({
  targetTitles: z.array(z.string()).default([]),
  stretchTitles: z.array(z.string()).default([]),
  coreSkills: z.array(z.string()).default([]),
  seniority: z.array(z.enum(["intern", "junior", "mid", "senior"])).default([]),
  country: z.string().length(2).optional(),
  timezone: z.string().optional(),
  remoteScopes: z
    .object({
      worldwide: z.boolean().default(true),
      regions: z.array(z.string()).default([]),
      countries: z.array(z.string()).default([]),
      onsiteCities: z.array(z.string()).default([]),
    })
    .default({ worldwide: true, regions: [], countries: [], onsiteCities: [] }),
  maxTimezoneDiffHours: z.number().min(0).max(14).optional(),
  minAnnualUsd: z.number().nonnegative().optional(),
  showUnlistedPay: z.boolean().default(true),
  hideBelowMinimum: z.boolean().default(false),
  employmentTypes: z.array(z.enum(["full_time", "contract", "part_time"])).default(["full_time", "contract"]),
  excludedCompanies: z.array(z.string()).default([]),
  excludedKeywords: z.array(z.string()).default([]),
  preferLesserKnown: z.boolean().default(true),
  showStaffingAgencies: z.boolean().default(false),
});
export type SearchPreferences = z.infer<typeof searchPreferencesSchema>;
