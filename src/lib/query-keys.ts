/**
 * Every TanStack Query key in the app lives here, so invalidation and
 * optimistic updates always name the same keys as the queries they touch.
 * Keys are arrays from general to specific: invalidating ["feed"] covers every
 * filtered feed list.
 */

export type FeedSort = "fit" | "newest" | "pay";

/** Feed filters (PRD F5). Part of the feed query key. */
export type FeedFilters = {
  sort?: FeedSort;
  remote?: "worldwide" | "my_region" | "any";
  payListed?: boolean;
  minAnnualUsd?: number;
  seniority?: string[];
  employmentType?: string[];
  directOnly?: boolean;
  savedOnly?: boolean;
  search?: string;
};

const FEED_DEFAULTS: Required<Pick<FeedFilters, "sort">> = { sort: "fit" };

/**
 * Canonical form of feed filters for a query key: defaults filled in, empty
 * values dropped, arrays sorted, keys in a fixed order. Two filter objects
 * that mean the same thing produce the same key.
 */
export function normalizeFeedFilters(filters: FeedFilters = {}): FeedFilters {
  const f = { ...FEED_DEFAULTS, ...filters };
  const out: FeedFilters = {};
  const keys = Object.keys(f).sort() as (keyof FeedFilters)[];
  for (const k of keys) {
    const v = f[k];
    if (v === undefined || v === null || v === false || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      (out as Record<string, unknown>)[k] = [...v].sort();
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t) (out as Record<string, unknown>)[k] = k === "search" ? t.toLowerCase() : t;
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export const queryKeys = {
  feed: {
    all: ["feed"] as const,
    list: (filters: FeedFilters = {}) => ["feed", "list", normalizeFeedFilters(filters)] as const,
  },
  job: {
    all: ["job"] as const,
    detail: (jobId: string) => ["job", jobId] as const,
  },
  pipeline: {
    status: ["pipeline", "status"] as const,
    runs: ["pipeline", "runs"] as const,
  },
  companies: {
    all: ["companies"] as const,
    list: (filters: { search?: string; muted?: boolean } = {}) => ["companies", "list", filters] as const,
    detect: (url: string) => ["companies", "detect", url] as const,
  },
  tracker: {
    board: ["tracker", "board"] as const,
  },
  tailorings: {
    all: ["tailorings"] as const,
    history: ["tailorings", "history"] as const,
    detail: (tailoringId: string) => ["tailorings", tailoringId] as const,
  },
  profile: {
    current: ["profile", "current"] as const,
    versions: ["profile", "versions"] as const,
    sources: ["profile", "sources"] as const,
  },
  preferences: ["preferences"] as const,
  preferenceSuggestion: ["preferences", "suggestion"] as const,
  settings: {
    ai: ["settings", "ai"] as const,
  },
} as const;

/**
 * Mutation keys let any component read a mutation's state with
 * useMutationState, for example the tailoring progress steps.
 */
export const mutationKeys = {
  tailor: {
    parse: ["tailor", "parse"] as const,
    tailor: ["tailor", "tailor"] as const,
  },
  job: {
    save: ["job", "save"] as const,
    dismiss: ["job", "dismiss"] as const,
    markApplied: ["job", "markApplied"] as const,
  },
  tracker: {
    move: ["tracker", "move"] as const,
  },
  profile: {
    edit: ["profile", "edit"] as const,
  },
} as const;
