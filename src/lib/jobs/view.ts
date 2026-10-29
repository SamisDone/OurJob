/**
 * What the Today table and the job sheet show for one job, and the plain
 * labels for its numbers. Unknown values stay unknown (golden rule 9).
 */

export type Eligibility = "eligible" | "unclear" | "ineligible";

export type FeedJob = {
  id: string;
  title: string;
  company: string;
  /** First seen in the last 14 days. */
  newCompany: boolean;
  /** New since the last visit. */
  isNew: boolean;
  saved: boolean;
  /** Where the job came from, for the source line: "Careers page (Ashby)", "Himalayas". */
  source: string;
  /** Company-direct (tier 1) or a job board or aggregator. */
  direct: boolean;
  where: string;
  eligibility: Eligibility;
  /** Why eligibility is unclear, quoted from the post. */
  eligibilityNote?: string;
  /** Yearly pay in USD. null when the post does not say. */
  pay: { min: number; max?: number; approx: boolean } | null;
  /** ISO date. null when no source gives a reliable date. */
  postedAt: string | null;
  /** 0 to 100. null until scored. */
  fit: number | null;
  reasons: string[];
  missing: string[];
  url: string;
};

export type MatchTone = "success" | "warning" | "secondary" | "outline";

/** "88, Strong match". Strong from 80, partial from 60. */
export function matchLabel(fit: number | null): { text: string; label: string; tone: MatchTone } {
  if (fit === null) return { text: "Not scored yet", label: "Not scored yet", tone: "outline" };
  const label = fit >= 80 ? "Strong match" : fit >= 60 ? "Partial match" : "Weak match";
  const tone: MatchTone = fit >= 80 ? "success" : fit >= 60 ? "warning" : "secondary";
  return { text: `${fit}, ${label}`, label, tone };
}

export const isStrongMatch = (job: Pick<FeedJob, "fit">) => job.fit !== null && job.fit >= 80;

const k = (n: number) => `$${Math.round(n / 1000)}k`;

/** "$95k to $130k", "approx. $64k", or "Not listed". Always per year, in USD. */
export function formatPay(pay: FeedJob["pay"]): string {
  if (!pay) return "Not listed";
  const range = pay.max && pay.max !== pay.min ? `${k(pay.min)} to ${k(pay.max)}` : k(pay.min);
  return pay.approx ? `approx. ${range}` : range;
}

const DAY = 86_400_000;

/** "Today", "Yesterday", "3 days ago", or "Date unknown". Counted in whole days in UTC. */
export function formatPosted(postedAt: string | null, now: Date): string {
  if (!postedAt) return "Date unknown";
  const day = (d: Date) => Math.floor(d.getTime() / DAY);
  const days = day(now) - day(new Date(postedAt));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

/** "6:32 AM" in his time zone. */
export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** The daily search is late when the last one finished more than 30 hours ago. */
export const isSearchLate = (finishedAt: string, now: Date) => now.getTime() - Date.parse(finishedAt) > 30 * 3_600_000;

export const eligibilityLabel: Record<Eligibility, { text: string; tone: "success" | "warning" | "destructive" }> = {
  eligible: { text: "Open to you", tone: "success" },
  unclear: { text: "Location unclear", tone: "warning" },
  ineligible: { text: "Not open to you", tone: "destructive" },
};

export type FeedFilter = "all" | "strong" | "pay" | "saved";

export const feedFilters: { value: FeedFilter; label: string; test: (j: FeedJob) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "strong", label: "Strong match", test: isStrongMatch },
  { value: "pay", label: "Pay listed", test: (j) => j.pay !== null },
  { value: "saved", label: "Saved", test: (j) => j.saved },
];
