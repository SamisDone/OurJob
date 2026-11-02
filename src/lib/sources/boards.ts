import { z } from "zod";
import type { EmploymentType, Workplace } from "@/lib/jobs/types";
import type { AtsType, BoardAdapter, Posting } from "./types";

/**
 * Tier 1 adapters, coded against real responses saved in
 * tests/fixtures/sources/{greenhouse,lever,ashby}/ (DECISIONS.md, 2026-11-02).
 * Each posting is read on its own, so one odd posting never loses the board.
 */

const date = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const each = <T>(items: unknown, schema: z.ZodType<T>, map: (item: T) => Posting | null): Posting[] =>
  (Array.isArray(items) ? items : []).flatMap((item) => {
    const parsed = schema.safeParse(item);
    const out = parsed.success ? map(parsed.data) : null;
    return out ? [out] : [];
  });

/* Greenhouse: `first_published` is the post date; `updated_at` changes on every edit, so it is never used. */
const greenhouseJob = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string(),
  location: z.object({ name: z.string() }).nullish(),
  first_published: z.string().nullish(),
  content: z.string().nullish(),
});

export const greenhouse: BoardAdapter = {
  id: "greenhouse",
  tier: 1,
  label: "Careers page (Greenhouse)",
  url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
  parse: (json) =>
    each((json as { jobs?: unknown })?.jobs, greenhouseJob, (j) => ({
      sourceJobId: String(j.id),
      title: j.title.trim(),
      html: j.content ?? "",
      url: j.absolute_url,
      applyUrl: j.absolute_url,
      locations: splitLocations(j.location?.name ?? ""),
      hints: {},
      postedAt: date(j.first_published),
    })),
};

/* Lever: `createdAt` is ms since epoch; `workplaceType` and `country` are structured. */
const leverJob = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string(),
  applyUrl: z.string().nullish(),
  createdAt: z.number().nullish(),
  description: z.string().nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
  additional: z.string().nullish(),
  categories: z
    .object({
      location: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
      commitment: z.string().nullish(),
    })
    .nullish(),
  workplaceType: z.string().nullish(),
  country: z.string().nullish(),
});

const LEVER_WORKPLACE: Record<string, Workplace> = { remote: "remote", hybrid: "hybrid", onsite: "onsite" };

export const lever: BoardAdapter = {
  id: "lever",
  tier: 1,
  label: "Careers page (Lever)",
  url: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  parse: (json) =>
    each(json, leverJob, (j) => {
      const lists = (j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
      const locations = j.categories?.allLocations?.length
        ? j.categories.allLocations
        : splitLocations(j.categories?.location ?? "");
      return {
        sourceJobId: j.id,
        title: j.text.trim(),
        html: `${j.description ?? ""}${lists}${j.additional ?? ""}`,
        url: j.hostedUrl,
        applyUrl: j.applyUrl || j.hostedUrl,
        locations,
        hints: {
          workplace: LEVER_WORKPLACE[j.workplaceType ?? ""],
          countries: j.country && /^[A-Z]{2}$/.test(j.country) ? [j.country] : undefined,
        },
        employmentType: employmentType(j.categories?.commitment),
        postedAt: date(j.createdAt),
      };
    }),
};

/* Ashby: `publishedAt`, `isRemote`, `workplaceType`, and an address per location. Unlisted postings are skipped. */
const ashbyAddress = z
  .object({ postalAddress: z.object({ addressCountry: z.string().nullish() }).nullish() })
  .nullish();
const ashbyJob = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  secondaryLocations: z.array(z.object({ location: z.string().nullish(), address: ashbyAddress })).nullish(),
  address: ashbyAddress,
  publishedAt: z.string().nullish(),
  isListed: z.boolean().nullish(),
  isRemote: z.boolean().nullish(),
  workplaceType: z.string().nullish(),
  employmentType: z.string().nullish(),
  jobUrl: z.string(),
  applyUrl: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
});

const ASHBY_WORKPLACE: Record<string, Workplace> = { Remote: "remote", Hybrid: "hybrid", OnSite: "onsite" };

export const ashby: BoardAdapter = {
  id: "ashby",
  tier: 1,
  label: "Careers page (Ashby)",
  url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
  parse: (json) =>
    each((json as { jobs?: unknown })?.jobs, ashbyJob, (j) => {
      if (j.isListed === false) return null;
      const all = [{ location: j.location, address: j.address }, ...(j.secondaryLocations ?? [])];
      return {
        sourceJobId: j.id,
        title: j.title.trim(),
        html: j.descriptionHtml ?? "",
        url: j.jobUrl,
        applyUrl: j.applyUrl || j.jobUrl,
        locations: all.map((l) => l.location?.trim() ?? "").filter(Boolean),
        hints: {
          workplace: ASHBY_WORKPLACE[j.workplaceType ?? ""] ?? (j.isRemote ? "remote" : undefined),
          // Country names ("United States", "European Union"); the location rules read them like a location.
          countries: all.map((l) => l.address?.postalAddress?.addressCountry?.trim() ?? "").filter(Boolean),
        },
        employmentType: employmentType(j.employmentType),
        postedAt: date(j.publishedAt),
      };
    }),
};

export const ADAPTERS: Record<AtsType, BoardAdapter> = { greenhouse, lever, ashby };

/** "Remote, Canada; Remote, United States" to its two locations; "Remote (United States | Canada)" stays one. */
export function splitLocations(raw: string): string[] {
  return raw
    .split(/\s*[;|]\s*(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "FullTime", "Full-time", "Permanent", "Contract", "Intern"... */
export function employmentType(raw: string | null | undefined): EmploymentType | undefined {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return undefined;
  if (/intern/.test(s)) return "internship";
  if (/parttime/.test(s)) return "part_time";
  if (/contract|freelance|consult/.test(s)) return "contract";
  if (/temp/.test(s)) return "temporary";
  if (/fulltime|permanent|regular/.test(s)) return "full_time";
  return undefined;
}
