import { canonicalUrl } from "@/lib/pipeline/dedupe";
import { locate } from "@/lib/pipeline/location";
import { parseSalaryText } from "@/lib/pipeline/salary";
import { decodeEntities, htmlToText, sanitizeHtml } from "./html";
import type { Board, BoardAdapter, NormalizedJob, Posting } from "./types";

/** An adapter's posting to the stored shape: sanitized HTML, text, location and scope, salary, dates. */
export function normalizePosting(p: Posting, adapter: BoardAdapter, board: Board): NormalizedJob {
  const descriptionHtml = sanitizeHtml(decodeEntities(p.html));
  const descriptionText = htmlToText(descriptionHtml);
  const { workplace, remoteScope } = locate(p.locations, p.hints);
  return {
    source: adapter.id,
    tier: adapter.tier,
    sourceJobId: p.sourceJobId,
    companyName: board.companyName,
    atsType: board.ats,
    atsSlug: board.slug,
    title: p.title,
    descriptionHtml,
    descriptionText,
    applyUrl: p.applyUrl,
    canonicalUrl: canonicalUrl(p.url),
    locationRaw: p.locations.join("; "),
    workplace,
    remoteScope,
    employmentType: p.employmentType,
    salary: p.salary ?? parseSalaryText(descriptionText),
    postedAt: p.postedAt,
    postedAtSource: p.postedAt ? "source_field" : "unknown",
  };
}
