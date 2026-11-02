import { regionsFor } from "@/lib/geo";
import type { Eligibility } from "@/lib/jobs/view";
import type { RemoteScope, Workplace } from "@/lib/jobs/types";
import type { SearchPreferences } from "@/lib/profile/schema";

/**
 * Can he work this job from where he lives (docs/JOB_SOURCES.md section 9)?
 * Worldwide, or his country or region is named, or one he said he can work
 * in: eligible. Nothing known: unclear. Named places without his: ineligible.
 * Office and hybrid jobs count only in the cities he listed.
 */
export function eligibilityOf(
  job: { workplace: Workplace; remoteScope: RemoteScope | null; locationRaw: string },
  prefs: Pick<SearchPreferences, "country" | "remoteScopes">,
): Eligibility {
  if (job.workplace === "onsite" || job.workplace === "hybrid") {
    const loc = job.locationRaw.toLowerCase();
    return prefs.remoteScopes.onsiteCities.some((c) => c.trim() && loc.includes(c.trim().toLowerCase()))
      ? "eligible"
      : "ineligible";
  }
  const scope = job.remoteScope ?? { kind: "unknown" };
  if (scope.kind === "unknown") return "unclear";
  if (scope.kind === "worldwide") return prefs.remoteScopes.worldwide ? "eligible" : "unclear";
  const countries = new Set(
    [prefs.country, ...prefs.remoteScopes.countries].filter(Boolean).map((c) => c!.toUpperCase()),
  );
  const regions = new Set([...regionsFor(prefs.country), ...prefs.remoteScopes.regions].map((r) => r.toLowerCase()));
  if ((scope.countries ?? []).some((c) => countries.has(c.toUpperCase()))) return "eligible";
  if ((scope.regions ?? []).some((r) => regions.has(r.toLowerCase()))) return "eligible";
  // Without his country the named places cannot be checked.
  return countries.size || regions.size ? "ineligible" : "unclear";
}
