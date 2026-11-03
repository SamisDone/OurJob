import { z } from "zod";
import type { PoliteClient } from "@/lib/http/polite";
import type { Salary } from "@/lib/jobs/types";
import { canonicalUrl } from "@/lib/pipeline/dedupe";
import { locate } from "@/lib/pipeline/location";
import { parseSalaryText } from "@/lib/pipeline/salary";
import { employmentType } from "./boards";
import { decodeEntities, htmlToText, sanitizeHtml } from "./html";
import type { NormalizedJob } from "./types";

/**
 * Tier 2: remote job boards through their official APIs, coded against real
 * responses in tests/fixtures/sources/{himalayas,remotive,jobicy}/. Their
 * terms (DECISIONS.md, 2026-11-03): name the board and link to its page for
 * the job; Apply goes to the link they give, unchanged; never pass the jobs on
 * to other boards or Google Jobs; call rarely (Remotive at most 4 times a day,
 * Jobicy at most once an hour, Himalayas refreshes daily).
 */

export type FeedId = "himalayas" | "remotive" | "jobicy";

export type FeedContext = {
  http: PoliteClient;
  /** ISO countries of the people the run is for; Himalayas searches jobs open in each. */
  countries: string[];
  now: Date;
};

export type FeedAdapter = {
  id: FeedId;
  tier: 2;
  /** Board name for the source line and attribution. */
  label: string;
  fetch(ctx: FeedContext): Promise<NormalizedJob[]>;
};

const DAY = 86_400_000;
const FRESH_DAYS = 7;
const PER_YEAR: Record<Salary["period"], number> = { year: 1, month: 12, day: 260, hour: 2080 };

/** Pay the board states in fields. Converted to yearly USD only when it is in USD; other currencies wait for exchange rates. */
function structuredSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined,
): Salary | undefined {
  if (!min && !max) return undefined;
  const per = period ?? "";
  if (/week|fortnight/i.test(per)) return undefined;
  const p: Salary["period"] = /hour/i.test(per)
    ? "hour"
    : /month/i.test(per)
      ? "month"
      : /day|daily/i.test(per)
        ? "day"
        : "year";
  const cur = (currency || "USD").toUpperCase();
  const usd = cur === "USD";
  return {
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
    currency: cur,
    period: p,
    ...(usd && min ? { annualUsdMin: Math.round(min * PER_YEAR[p]) } : {}),
    ...(usd && max ? { annualUsdMax: Math.round(max * PER_YEAR[p]) } : {}),
    source: "structured",
  };
}

const text = (html: string) => {
  const descriptionHtml = sanitizeHtml(decodeEntities(html));
  return { descriptionHtml, descriptionText: htmlToText(descriptionHtml) };
};

/* Himalayas: search by country (it includes worldwide roles open there), newest first, 20 a page.
   `pubDate` is when the job was last updated, not posted, so it only bounds the search; the post
   date comes from when we first saw the job (docs/JOB_SOURCES.md section 8). */
const himalayasJob = z.object({
  title: z.string(),
  companyName: z.string(),
  employmentType: z.string().nullish(),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  salaryPeriod: z.string().nullish(),
  currency: z.string().nullish(),
  locationRestrictions: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  pubDate: z.number(),
  expiryDate: z.number().nullish(),
  applicationLink: z.string(),
  guid: z.string(),
});
const HIMALAYAS_QUERIES = ["engineer", "developer"];
const HIMALAYAS_MAX_PAGES = 15;

export const himalayas: FeedAdapter = {
  id: "himalayas",
  tier: 2,
  label: "Himalayas",
  async fetch({ http, countries, now }) {
    const out = new Map<string, NormalizedJob>();
    const since = now.getTime() - FRESH_DAYS * DAY;
    for (const country of countries.length ? countries : [null]) {
      for (const q of HIMALAYAS_QUERIES) {
        for (let page = 1; page <= HIMALAYAS_MAX_PAGES; page++) {
          const params = new URLSearchParams({ q, sort: "recent", page: String(page) });
          if (country) params.set("country", country);
          else params.set("worldwide", "true");
          const res = await http.getJson<{ jobs?: unknown[] }>(`https://himalayas.app/jobs/api/search?${params}`);
          const jobs = (res.jobs ?? []).flatMap((j) => {
            const p = himalayasJob.safeParse(j);
            return p.success ? [p.data] : [];
          });
          if (!jobs.length) break;
          for (const j of jobs) {
            if (j.pubDate * 1000 < since) continue;
            if (j.expiryDate && j.expiryDate * 1000 < now.getTime()) continue; // their terms: remove expired jobs
            const restrictions = j.locationRestrictions ?? [];
            // An empty restriction list means anywhere (their docs); the country names go through the location rules.
            const { remoteScope } = restrictions.length
              ? locate([`Remote, ${restrictions.join(", ")}`], { workplace: "remote" })
              : { remoteScope: { kind: "worldwide" as const, confidence: "structured" as const } };
            out.set(j.guid, {
              source: "himalayas",
              tier: 2,
              sourceJobId: j.guid,
              companyName: j.companyName.trim(),
              title: j.title.trim(),
              ...text(j.description ?? ""),
              applyUrl: j.applicationLink,
              canonicalUrl: canonicalUrl(j.guid),
              locationRaw: restrictions.length ? `Remote (${restrictions.join(", ")})` : "Remote (anywhere)",
              workplace: "remote",
              remoteScope: { ...remoteScope, confidence: "structured" },
              employmentType: employmentType(j.employmentType),
              salary: structuredSalary(j.minSalary, j.maxSalary, j.currency, j.salaryPeriod),
              postedAt: undefined,
              postedAtSource: "unknown",
              attribution: { label: "Himalayas", url: j.guid },
              closesAt: j.expiryDate ? new Date(j.expiryDate * 1000) : undefined,
            });
          }
          // "Recent" is not strictly by date: stop only when a whole page is older than the window.
          if (jobs.every((j) => j.pubDate * 1000 < since)) break;
        }
      }
    }
    return [...out.values()];
  },
};

/* Remotive: every active job in one call (their API returns a small set, delayed 24 hours).
   `publication_date` is the post date on Remotive, written without a zone; it is UTC. */
const remotiveJob = z.object({
  id: z.number(),
  url: z.string(),
  title: z.string(),
  company_name: z.string(),
  job_type: z.string().nullish(),
  publication_date: z.string(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
  description: z.string().nullish(),
});

export const remotive: FeedAdapter = {
  id: "remotive",
  tier: 2,
  label: "Remotive",
  async fetch({ http }) {
    const res = await http.getJson<{ jobs?: unknown[] }>("https://remotive.com/api/remote-jobs");
    return (res.jobs ?? []).flatMap((raw) => {
      const p = remotiveJob.safeParse(raw);
      if (!p.success) return [];
      const j = p.data;
      const where = j.candidate_required_location?.trim() || "";
      const posted = new Date(
        /[zZ]|[+-]\d\d:?\d\d$/.test(j.publication_date) ? j.publication_date : `${j.publication_date}Z`,
      );
      const { workplace, remoteScope } = locate([where ? `Remote, ${where}` : "Remote"], { workplace: "remote" });
      const body = text(j.description ?? "");
      return [
        {
          source: "remotive",
          tier: 2 as const,
          sourceJobId: String(j.id),
          companyName: j.company_name.trim(),
          title: j.title.trim(),
          ...body,
          applyUrl: j.url,
          canonicalUrl: canonicalUrl(j.url),
          locationRaw: where ? `Remote (${where})` : "Remote",
          workplace,
          remoteScope,
          employmentType: employmentType(j.job_type),
          salary: (j.salary ? parseSalaryText(j.salary) : undefined) ?? parseSalaryText(body.descriptionText),
          postedAt: Number.isNaN(posted.getTime()) ? undefined : posted,
          postedAtSource: Number.isNaN(posted.getTime()) ? ("unknown" as const) : ("source_field" as const),
          attribution: { label: "Remotive", url: j.url },
        },
      ];
    });
  },
};

/* Jobicy: the last 7 days only (their API's window), up to 100 a page with a cursor.
   `pubDate` is the original publication date. Apply goes to the Jobicy page (their free-API rule). */
const jobicyJob = z.object({
  id: z.number(),
  url: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobType: z.array(z.string()).nullish(),
  jobGeo: z.string().nullish(),
  jobDescription: z.string().nullish(),
  pubDate: z.string(),
  salaryMin: z.number().nullish(),
  salaryMax: z.number().nullish(),
  salaryCurrency: z.string().nullish(),
  salaryPeriod: z.string().nullish(),
});
const JOBICY_INDUSTRIES = ["engineering", "admin"]; // Software Engineering; DevOps & Infrastructure
const JOBICY_MAX_PAGES = 5;

export const jobicy: FeedAdapter = {
  id: "jobicy",
  tier: 2,
  label: "Jobicy",
  async fetch({ http }) {
    const out = new Map<string, NormalizedJob>();
    for (const industry of JOBICY_INDUSTRIES) {
      let cursor: string | null = null;
      for (let page = 0; page < JOBICY_MAX_PAGES; page++) {
        const params = new URLSearchParams({ industry, count: "100" });
        if (cursor) params.set("cursor", cursor);
        const res = await http.getJson<{ jobs?: unknown[]; nextCursor?: string | null; hasMore?: boolean }>(
          `https://jobicy.com/api/jobs?${params}`,
        );
        for (const raw of res.jobs ?? []) {
          const p = jobicyJob.safeParse(raw);
          if (!p.success) continue;
          const j = p.data;
          const geo = (j.jobGeo ?? "").replace(/\s+/g, " ").trim();
          const { workplace, remoteScope } = locate([geo ? `Remote, ${geo}` : "Remote"], { workplace: "remote" });
          const posted = new Date(j.pubDate);
          out.set(String(j.id), {
            source: "jobicy",
            tier: 2,
            sourceJobId: String(j.id),
            companyName: decodeEntities(j.companyName).trim(),
            title: decodeEntities(j.jobTitle).trim(),
            ...text(j.jobDescription ?? ""),
            applyUrl: j.url,
            canonicalUrl: canonicalUrl(j.url),
            locationRaw: geo ? `Remote (${geo})` : "Remote",
            workplace,
            remoteScope,
            employmentType: employmentType(j.jobType?.[0]),
            salary: structuredSalary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod),
            postedAt: Number.isNaN(posted.getTime()) ? undefined : posted,
            postedAtSource: Number.isNaN(posted.getTime()) ? "unknown" : "source_field",
            attribution: { label: "Jobicy", url: j.url },
          });
        }
        cursor = res.hasMore && res.nextCursor ? res.nextCursor : null;
        if (!cursor) break;
      }
    }
    return [...out.values()];
  },
};

export const FEEDS: Record<FeedId, FeedAdapter> = { himalayas, remotive, jobicy };
