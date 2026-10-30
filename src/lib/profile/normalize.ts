import type { P1Output } from "@/lib/llm/prompts/p1-profile";
import { parseCvDate } from "./dates";
import type { Bullet, MasterProfile, SourceTag } from "./schema";
import { canonicalSkill, knownAliases, mentions, skillFold } from "./skills";

/**
 * Code that runs after P1 (docs/AI_PROMPTS.md, "After P1"). Turns the
 * model's answer into a MasterProfile:
 * - stable ids: exp_1, b_1_2, proj_1, b_p1_1, edu_1, h_1_1, sk_<name>, ...
 * - dates normalized to YYYY-MM, YYYY or "present"
 * - skills renamed to canonical names and duplicates merged
 * - skill evidence computed from bullet text and tech lines, not trusted
 *   from the model
 * - metrics and bold phrases kept only when they are literally in the text
 * - conflicts pointed at the item they belong to
 */

const uniq = <T>(xs: T[]) => [...new Set(xs)];

function sourcesOf(xs: SourceTag[] | undefined): SourceTag[] {
  return uniq(xs ?? []);
}

function cleanBullet(raw: P1Output["experience"][number]["bullets"][number], id: string): Bullet {
  // If the model left **bold** markers in, turn them into bold phrases.
  const fromMarkers = [...raw.text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
  const text = raw.text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return {
    id,
    text,
    boldPhrases: uniq([...raw.boldPhrases, ...fromMarkers].map((p) => p.trim())).filter((p) => p && text.includes(p)),
    skills: uniq(raw.skills.map(canonicalSkill)),
    metrics: raw.metrics
      .filter((m) => m.value && text.includes(m.value))
      .map((m) => (m.hedge && text.toLowerCase().includes(m.hedge.toLowerCase()) ? m : { value: m.value })),
    sources: sourcesOf(raw.sources),
  };
}

function slug(name: string) {
  return (
    skillFold(name)
      .replace(/\+/g, "plus")
      .replace(/#/g, "sharp")
      .replace(/[^a-z0-9]/g, "") || "skill"
  );
}

function date(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return parseCvDate(value) ?? value.trim();
}

const nameKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function normalizeProfile(raw: P1Output): MasterProfile {
  const experience = raw.experience.map((e, i) => ({
    id: `exp_${i + 1}`,
    company: e.company.trim(),
    companyUrl: e.companyUrl,
    title: e.title.trim(),
    location: e.location,
    employmentType: e.employmentType,
    start: date(e.start) ?? "",
    end: date(e.end) ?? "present",
    bullets: e.bullets.map((b, j) => cleanBullet(b, `b_${i + 1}_${j + 1}`)),
    tech: uniq(e.tech.map((t) => t.trim()).filter(Boolean)),
    sources: sourcesOf(e.sources),
  }));

  const projects = raw.projects.map((p, i) => ({
    id: `proj_${i + 1}`,
    name: p.name.trim(),
    liveUrl: p.liveUrl,
    sourceUrl: p.sourceUrl,
    role: p.role,
    start: date(p.start),
    end: date(p.end),
    description: p.description.trim(),
    bullets: p.bullets.map((b, j) => cleanBullet(b, `b_p${i + 1}_${j + 1}`)),
    tech: uniq(p.tech.map((t) => t.trim()).filter(Boolean)),
    sources: sourcesOf(p.sources),
  }));

  const education = raw.education.map((e, i) => ({
    id: `edu_${i + 1}`,
    institution: e.institution.trim(),
    degree: e.degree.trim(),
    field: e.field,
    location: e.location,
    start: date(e.start),
    end: date(e.end),
    grade: e.grade,
    highlights: e.highlights.map((h, j) => ({
      id: `h_${i + 1}_${j + 1}`,
      text: h.text,
      sources: sourcesOf(h.sources),
    })),
    sources: sourcesOf(e.sources),
  }));

  // Skills: canonical names, duplicates merged, evidence computed from the text.
  const merged = new Map<string, MasterProfile["skills"][number]>();
  for (const s of raw.skills) {
    const name = canonicalSkill(s.name);
    const key = skillFold(name);
    const aliases = [s.name, ...s.aliases].map((a) => a.trim()).filter((a) => a && skillFold(a) !== key);
    const existing = merged.get(key);
    if (existing) {
      existing.aliases = uniq([...existing.aliases, ...aliases]);
      existing.sources = uniq([...existing.sources, ...s.sources]);
    } else {
      merged.set(key, {
        id: `sk_${slug(name)}`,
        name,
        aliases: uniq(aliases),
        category: s.category,
        evidence: [],
        sources: sourcesOf(s.sources),
      });
    }
  }
  const usedIds = new Set<string>();
  for (const skill of merged.values()) {
    let id = skill.id;
    for (let n = 2; usedIds.has(id); n++) id = `${skill.id}_${n}`;
    skill.id = id;
    usedIds.add(id);
    const terms = uniq([skill.name, ...skill.aliases, ...knownAliases(skill.name)]);
    const hit = (text: string, listed: string[]) =>
      listed.some((x) => skillFold(canonicalSkill(x)) === skillFold(skill.name)) ||
      terms.some((t) => mentions(text, t));
    for (const e of experience) for (const b of e.bullets) if (hit(b.text, b.skills)) skill.evidence.push(b.id);
    for (const p of projects) {
      if (hit(`${p.description} ${p.tech.join(", ")}`, p.tech)) skill.evidence.push(p.id);
      for (const b of p.bullets) if (hit(b.text, b.skills)) skill.evidence.push(b.id);
    }
    skill.evidence = uniq(skill.evidence);
  }

  // Conflicts point at items by id: "experience.exp_2.end".
  const findId = (section: string, ref: string): string | undefined => {
    const key = nameKey(ref);
    if (section === "experience")
      return experience.find((e) => nameKey(e.company) === key || nameKey(e.company).includes(key))?.id;
    if (section === "projects") return projects.find((p) => nameKey(p.name) === key)?.id;
    if (section === "education")
      return education.find((e) => nameKey(e.institution) === key || nameKey(e.institution).includes(key))?.id;
    return undefined;
  };
  const conflicts = raw.conflicts
    .filter((c) => c.values.length > 1 && new Set(c.values.map((v) => v.value.trim().toLowerCase())).size > 1)
    .map((c) => {
      const id = c.section === "basics" ? "basics" : findId(c.section, c.itemRef);
      const isDate = c.attribute === "start" || c.attribute === "end";
      return {
        field: id
          ? c.section === "basics"
            ? `basics.${c.attribute}`
            : `${c.section}.${id}.${c.attribute}`
          : `${c.section}.?${c.itemRef}.${c.attribute}`,
        values: c.values.map((v) => ({
          value: isDate ? (date(v.value) ?? v.value) : v.value.trim(),
          source: v.source,
        })),
      };
    });

  return {
    basics: {
      name: raw.basics.name.trim(),
      headline: raw.basics.headline,
      email: raw.basics.email,
      phone: raw.basics.phone,
      location: raw.basics.location,
      links: raw.basics.links.map((l, i) => ({ id: `link_${i + 1}`, label: l.label, url: l.url })),
      summary: raw.basics.summary
        ? { id: "summary", text: raw.basics.summary.text, sources: sourcesOf(raw.basics.summary.sources) }
        : undefined,
    },
    experience,
    projects,
    education,
    skills: [...merged.values()],
    certifications: raw.certifications.map((c, i) => ({
      id: `cert_${i + 1}`,
      ...c,
      date: date(c.date),
      sources: sourcesOf(c.sources),
    })),
    awards: raw.awards.map((a, i) => ({ id: `award_${i + 1}`, ...a, sources: sourcesOf(a.sources) })),
    languages: raw.languages.map((l, i) => ({ id: `lang_${i + 1}`, ...l, sources: sourcesOf(l.sources) })),
    publications: raw.publications.map((x, i) => ({
      id: `pub_${i + 1}`,
      ...x,
      date: date(x.date),
      sources: sourcesOf(x.sources),
    })),
    extraSections: raw.extraSections.map((s, i) => ({
      id: `sec_${i + 1}`,
      title: s.title.trim(),
      items: s.items.map((it, j) => ({ id: `sec_${i + 1}_${j + 1}`, text: it.text, sources: sourcesOf(it.sources) })),
    })),
    unplaced: [],
    conflicts,
  };
}
