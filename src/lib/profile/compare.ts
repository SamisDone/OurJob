import type { MasterProfile } from "./schema";
import { skillFold } from "./skills";

/**
 * Checks a profile against hand-written expected facts (tests/fixtures/expected).
 * Used by unit tests (mock provider) and by `pnpm eval:prompts` (real provider)
 * to report which facts a P1 answer missed.
 */
export type ExpectedFacts = {
  name: string;
  email?: string;
  experience: { company: string; title: string; start: string; end: string; bullets?: number }[];
  projects: string[];
  education: { institution: string; end?: string }[];
  skills: string[];
  certifications: string[];
  metrics: string[];
  hedges: { value: string; hedge: string }[];
  conflicts: string[];
};

const eq = (a: string | undefined, b: string | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function compareProfile(p: MasterProfile, x: ExpectedFacts): string[] {
  const missing: string[] = [];
  if (!eq(p.basics.name, x.name)) missing.push(`name: expected "${x.name}", got "${p.basics.name}"`);
  if (x.email && !eq(p.basics.email, x.email)) missing.push(`email: expected ${x.email}`);

  for (const e of x.experience) {
    const role = p.experience.find((r) => eq(r.company, e.company));
    if (!role) {
      missing.push(`experience: ${e.company} missing`);
      continue;
    }
    if (!eq(role.title, e.title)) missing.push(`experience ${e.company}: title "${role.title}", expected "${e.title}"`);
    if (role.start !== e.start) missing.push(`experience ${e.company}: start ${role.start}, expected ${e.start}`);
    if (role.end !== e.end) missing.push(`experience ${e.company}: end ${role.end}, expected ${e.end}`);
    if (e.bullets !== undefined && role.bullets.length < e.bullets)
      missing.push(`experience ${e.company}: ${role.bullets.length} bullets, expected ${e.bullets}`);
  }
  for (const name of x.projects)
    if (!p.projects.some((q) => eq(q.name, name))) missing.push(`project: ${name} missing`);
  for (const e of x.education) {
    const ed = p.education.find((q) => eq(q.institution, e.institution));
    if (!ed) missing.push(`education: ${e.institution} missing`);
    else if (e.end && ed.end !== e.end) missing.push(`education ${e.institution}: end ${ed.end}, expected ${e.end}`);
  }
  const skills = new Set(p.skills.map((s) => skillFold(s.name)));
  for (const s of x.skills) if (!skills.has(skillFold(s))) missing.push(`skill: ${s} missing`);
  for (const c of x.certifications)
    if (!p.certifications.some((q) => eq(q.name, c))) missing.push(`certification: ${c} missing`);

  const metrics = [...p.experience, ...p.projects].flatMap((i) => i.bullets.flatMap((b) => b.metrics));
  for (const m of x.metrics) if (!metrics.some((q) => q.value.includes(m))) missing.push(`metric: ${m} missing`);
  for (const h of x.hedges) {
    if (!metrics.some((q) => q.value.includes(h.value) && eq(q.hedge, h.hedge)))
      missing.push(`hedge: "${h.hedge}" on ${h.value} missing`);
  }
  for (const f of x.conflicts) if (!p.conflicts.some((c) => c.field === f)) missing.push(`conflict: ${f} missing`);
  return missing;
}
