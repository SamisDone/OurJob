import type { NormalizedJob } from "@/lib/sources/types";

/** Tracking parameters that do not identify the job (gh_jid does, so it stays). */
const TRACKING = /^(?:utm_.+|gh_src|lever-source|lever-origin|source|src|ref|referrer|fbclid|gclid)$/i;

/** The URL without tracking parameters or a fragment, query sorted, host lowercased. */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    const kept = [...url.searchParams].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
    url.search = new URLSearchParams(kept).toString();
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

const COMPANY_SUFFIX =
  /\b(?:inc|incorporated|ltd|limited|llc|gmbh|corp|corporation|co|plc|bv|ab|sa|ag|oy|as|pty|srl|sas)\b/g;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(COMPANY_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, without "(Remote)"-type notes and punctuation, so the same role reads the same everywhere. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\b(?:remote|hybrid|on-?site|worldwide|anywhere|global|f\/m\/d|m\/f\/d|m\/w\/d)\b[^)]*\)/g, " ")
    .replace(/\s[-–|]\s*(?:remote|hybrid|worldwide|anywhere)\b.*$/g, " ")
    .replace(/[^\p{L}\p{N}+#\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DAY = 86_400_000;

/**
 * One record per real-world job (docs/JOB_SOURCES.md section 10): the same
 * canonical URL, the same source id, or the same company, title and location
 * posted within 14 days. The highest tier wins; a missing salary is filled
 * from a duplicate, and every other copy is remembered in alsoSeenIn.
 */
export function dedupeJobs(
  jobs: NormalizedJob[],
): (NormalizedJob & { alsoSeenIn: { source: string; url: string }[] })[] {
  const ordered = [...jobs].sort(
    (a, b) => a.tier - b.tier || (a.postedAt?.getTime() ?? Infinity) - (b.postedAt?.getTime() ?? Infinity),
  );
  const kept: (NormalizedJob & { alsoSeenIn: { source: string; url: string }[] })[] = [];
  const byKey = new Map<string, (typeof kept)[number]>();
  const looseKey = (j: NormalizedJob) =>
    `${normalizeCompanyName(j.companyName)}|${normalizeTitle(j.title)}|${j.locationRaw.toLowerCase().replace(/\s+/g, " ").trim()}`;
  for (const job of ordered) {
    const keys = [`url:${job.canonicalUrl}`, `id:${job.source}:${job.sourceJobId}`];
    let same = keys.map((k) => byKey.get(k)).find(Boolean);
    if (!same) {
      const loose = byKey.get(`loose:${looseKey(job)}`);
      const close =
        loose &&
        (!loose.postedAt || !job.postedAt || Math.abs(loose.postedAt.getTime() - job.postedAt.getTime()) <= 14 * DAY);
      if (close) same = loose;
    }
    if (same) {
      if (same.source !== job.source || same.sourceJobId !== job.sourceJobId)
        same.alsoSeenIn.push({ source: job.source, url: job.applyUrl });
      if (!same.salary && job.salary) same.salary = { ...job.salary, source: "board" };
      for (const k of keys) byKey.set(k, same);
      continue;
    }
    const entry = { ...job, alsoSeenIn: [] };
    kept.push(entry);
    for (const k of [...keys, `loose:${looseKey(job)}`]) byKey.set(k, entry);
  }
  return kept;
}
