import { findKeyword, type KeywordLike } from "@/lib/ats/match";
import type { JobSpec, MasterProfile } from "@/lib/profile/schema";

export type MatchedKeyword = {
  term: string;
  canonical: string;
  importance: "must" | "nice";
  /** Profile item ids that prove it: skills, bullets, roles (tech line), projects, certifications. */
  proofIds: string[];
};
export type GapKeyword = { term: string; canonical: string; synonyms: string[]; importance: "must" | "nice" };

/**
 * Splits the job's keywords into what the profile proves (matched, with the
 * item ids) and what it does not (gaps). Titles are left out: they are scored
 * by title alignment, not placed in bullets.
 */
export function splitKeywords(
  spec: JobSpec,
  profile: MasterProfile,
): { matched: MatchedKeyword[]; gaps: GapKeyword[] } {
  const techTerms = [...profile.skills.flatMap((s) => [s.name, ...s.aliases]), ...spec.keywords.map((k) => k.term)];
  const opts = { techTerms };
  const items: { id: string; text: string; skills?: boolean }[] = [
    ...profile.skills.map((s) => ({ id: s.id, text: [s.name, ...s.aliases].join(", "), skills: true })),
    ...(profile.basics.summary ? [{ id: profile.basics.summary.id, text: profile.basics.summary.text }] : []),
    ...profile.experience.flatMap((e) => [
      { id: e.id, text: e.tech.join(", "), skills: true },
      ...e.bullets.map((b) => ({ id: b.id, text: b.text })),
    ]),
    ...profile.projects.flatMap((p) => [
      // The project's name is on the CV too ("AI Healthcare Platform" proves healthcare).
      { id: p.id, text: `${p.name}\n${p.description}\n${p.tech.join(", ")}` },
      ...p.bullets.map((b) => ({ id: b.id, text: b.text })),
    ]),
    ...profile.certifications.map((c) => ({ id: c.id, text: c.name })),
  ];

  const matched: MatchedKeyword[] = [];
  const gaps: GapKeyword[] = [];
  for (const k of spec.keywords) {
    if (k.kind === "title") continue;
    const kw: KeywordLike = { term: k.term, canonical: k.canonical, synonyms: k.synonyms };
    const proofIds = items.filter((i) => findKeyword(kw, i.text, i.skills, opts)).map((i) => i.id);
    if (proofIds.length) matched.push({ term: k.term, canonical: k.canonical, importance: k.importance, proofIds });
    else gaps.push({ term: k.term, canonical: k.canonical, synonyms: k.synonyms, importance: k.importance });
  }
  return { matched, gaps };
}
