import { z } from "zod";
import { parseCvDate } from "./dates";
import { masterProfileSchema, skillCategory, type Bullet, type MasterProfile } from "./schema";
import { canonicalSkill, mentions, skillFold } from "./skills";

/**
 * Profile edits as small operations. The client sends operations, never a
 * whole profile; the server applies them, validates the result and saves a
 * new version with a note ("Edited a bullet in Parcelwise").
 */

const section = z.enum(["experience", "projects", "education", "certifications"]);
const text = z.string().trim().min(1).max(2000);

export const editOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("setBasics"),
    fields: z
      .object({
        name: z.string().trim().min(1).max(200),
        headline: z.string().max(200),
        email: z.string().max(200),
        phone: z.string().max(60),
        location: z.string().max(200),
      })
      .partial(),
  }),
  z.object({ op: z.literal("setSummary"), text: z.string().max(2000) }),
  z.object({
    op: z.literal("updateItem"),
    section,
    id: z.string(),
    fields: z.record(z.string(), z.string().max(500)),
  }),
  z.object({ op: z.literal("addItem"), section, fields: z.record(z.string(), z.string().max(500)) }),
  z.object({ op: z.literal("removeItem"), section, id: z.string() }),
  z.object({ op: z.literal("updateBullet"), id: z.string(), text }),
  z.object({ op: z.literal("addBullet"), itemId: z.string(), text }),
  z.object({ op: z.literal("removeBullet"), id: z.string() }),
  z.object({ op: z.literal("reorderBullets"), itemId: z.string(), order: z.array(z.string()) }),
  z.object({ op: z.literal("addSkill"), name: z.string().trim().min(1).max(80), category: skillCategory }),
  z.object({ op: z.literal("removeSkill"), id: z.string() }),
  z.object({ op: z.literal("resolveConflict"), field: z.string(), value: z.string() }),
  z.object({ op: z.literal("removePublication"), id: z.string() }),
  z.object({ op: z.literal("updateSectionItem"), id: z.string(), text }),
  z.object({ op: z.literal("removeSectionItem"), id: z.string() }),
  /** CV text the profile did not hold: keep it as its own section, or set it aside. */
  z.object({ op: z.literal("placeUnplaced"), id: z.string() }),
  z.object({ op: z.literal("dismissUnplaced"), id: z.string() }),
]);
export type EditOp = z.infer<typeof editOpSchema>;

/** Fields a person may edit per section. Ids and sources are never edited directly. */
const EDITABLE: Record<z.infer<typeof section>, string[]> = {
  experience: ["company", "companyUrl", "title", "location", "employmentType", "start", "end"],
  projects: ["name", "liveUrl", "sourceUrl", "role", "start", "end", "description"],
  education: ["institution", "degree", "field", "location", "start", "end", "grade"],
  certifications: ["name", "issuer", "date", "url"],
};
const DATE_FIELDS = new Set(["start", "end", "date"]);
const REQUIRED: Record<z.infer<typeof section>, string[]> = {
  experience: ["company", "title", "start"],
  projects: ["name"],
  education: ["institution", "degree"],
  certifications: ["name"],
};

export class EditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditError";
  }
}

/** A new id that is never reused: user-added items get a random suffix. */
export function newId(prefix: string, taken: Set<string>): string {
  for (;;) {
    const id = `${prefix}_u${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
}

function allIds(p: MasterProfile): Set<string> {
  const ids = new Set<string>();
  const add = (x: { id: string }) => ids.add(x.id);
  p.experience.forEach((e) => (add(e), e.bullets.forEach(add)));
  p.projects.forEach((e) => (add(e), e.bullets.forEach(add)));
  p.education.forEach((e) => (add(e), e.highlights.forEach(add)));
  [p.skills, p.certifications, p.awards, p.languages, p.basics.links, p.publications, p.unplaced].forEach((xs) =>
    xs.forEach(add),
  );
  p.extraSections.forEach((s) => (add(s), s.items.forEach(add)));
  return ids;
}

function bulletOwners(p: MasterProfile) {
  return [
    ...p.experience.map((e) => ({ item: e, label: e.company })),
    ...p.projects.map((q) => ({ item: q, label: q.name })),
  ];
}

function cleanFields(sec: z.infer<typeof section>, fields: Record<string, string>) {
  const out: Record<string, string | undefined> = {};
  for (const [k, raw] of Object.entries(fields)) {
    if (!EDITABLE[sec].includes(k)) throw new EditError(`${k} cannot be edited here.`);
    const v = raw.trim();
    if (DATE_FIELDS.has(k) && v) {
      const d = parseCvDate(v);
      if (!d) throw new EditError(`"${v}" is not a date. Use a form like Mar 2024, 2024 or Present.`);
      out[k] = d;
    } else out[k] = v || undefined;
  }
  return out;
}

/** Recomputes a skill's evidence after bullets change. */
function refreshEvidence(p: MasterProfile) {
  for (const s of p.skills) {
    const terms = [s.name, ...s.aliases];
    const ev: string[] = [];
    const hit = (t: string, listed: string[]) =>
      listed.some((x) => skillFold(canonicalSkill(x)) === skillFold(s.name)) || terms.some((term) => mentions(t, term));
    for (const e of p.experience) for (const b of e.bullets) if (hit(b.text, b.skills)) ev.push(b.id);
    for (const q of p.projects) {
      if (hit(`${q.description} ${q.tech.join(", ")}`, q.tech)) ev.push(q.id);
      for (const b of q.bullets) if (hit(b.text, b.skills)) ev.push(b.id);
    }
    s.evidence = [...new Set(ev)];
  }
}

/** Applies operations to a copy of the profile. Returns the new profile and notes for the version history. */
export function applyEdits(profile: MasterProfile, ops: EditOp[]): { profile: MasterProfile; notes: string[] } {
  const p: MasterProfile = structuredClone(profile);
  const notes: string[] = [];
  const findBullet = (id: string) => {
    for (const o of bulletOwners(p)) {
      const i = o.item.bullets.findIndex((b) => b.id === id);
      if (i >= 0) return { ...o, index: i };
    }
    throw new EditError("That bullet no longer exists. Reload the page.");
  };
  const findItem = (sec: z.infer<typeof section>, id: string) => {
    const list = p[sec] as { id: string }[];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) throw new EditError("That item no longer exists. Reload the page.");
    return { list, index: i };
  };

  for (const op of ops) {
    switch (op.op) {
      case "setBasics": {
        Object.assign(
          p.basics,
          Object.fromEntries(Object.entries(op.fields).map(([k, v]) => [k, v?.trim() || undefined])),
        );
        if (!p.basics.name) throw new EditError("Your name cannot be empty.");
        notes.push("Edited your details");
        break;
      }
      case "setSummary": {
        const t = op.text.trim();
        p.basics.summary = t
          ? { id: "summary", text: t, sources: p.basics.summary?.sources ?? ["user_added"] }
          : undefined;
        notes.push("Edited the summary");
        break;
      }
      case "updateItem": {
        const { list, index } = findItem(op.section, op.id);
        const merged = { ...list[index], ...cleanFields(op.section, op.fields) } as Record<string, unknown>;
        for (const f of REQUIRED[op.section]) if (!merged[f]) throw new EditError(`${f} cannot be empty.`);
        list[index] = merged as { id: string };
        notes.push(`Edited ${String(merged.company ?? merged.name ?? merged.institution ?? "an item")}`);
        break;
      }
      case "addItem": {
        const fields = cleanFields(op.section, op.fields);
        for (const f of REQUIRED[op.section]) if (!fields[f]) throw new EditError(`${f} is needed.`);
        const prefix = { experience: "exp", projects: "proj", education: "edu", certifications: "cert" }[op.section];
        const base = { id: newId(prefix, allIds(p)), ...fields, sources: ["user_added" as const] };
        const item =
          op.section === "experience"
            ? { end: "present", ...base, bullets: [], tech: [] }
            : op.section === "projects"
              ? { description: "", ...base, bullets: [], tech: [] }
              : op.section === "education"
                ? { ...base, highlights: [] }
                : base;
        (p[op.section] as unknown[]).push(item);
        notes.push(`Added ${String(fields.company ?? fields.name ?? fields.institution)}`);
        break;
      }
      case "removeItem": {
        const { list, index } = findItem(op.section, op.id);
        const [gone] = list.splice(index, 1) as Record<string, unknown>[];
        p.conflicts = p.conflicts.filter((c) => !c.field.includes(`.${op.id}.`));
        notes.push(`Removed ${String(gone.company ?? gone.name ?? gone.institution)}`);
        break;
      }
      case "updateBullet": {
        const { item, index, label } = findBullet(op.id);
        const b = item.bullets[index];
        const next: Bullet = {
          ...b,
          text: op.text,
          boldPhrases: b.boldPhrases.filter((x) => op.text.includes(x)),
          metrics: b.metrics.filter((m) => op.text.includes(m.value)),
        };
        item.bullets[index] = next;
        notes.push(`Edited a bullet in ${label}`);
        break;
      }
      case "addBullet": {
        const owner = bulletOwners(p).find((o) => o.item.id === op.itemId);
        if (!owner) throw new EditError("That item no longer exists. Reload the page.");
        const prefix = owner.item.id.startsWith("proj")
          ? `b_${owner.item.id.replace("proj_", "p")}`
          : `b_${owner.item.id.replace("exp_", "")}`;
        owner.item.bullets.push({
          id: newId(prefix, allIds(p)),
          text: op.text,
          boldPhrases: [],
          skills: [],
          metrics: [],
          sources: ["user_added"],
        });
        notes.push(`Added a bullet to ${owner.label}`);
        break;
      }
      case "removeBullet": {
        const { item, index, label } = findBullet(op.id);
        item.bullets.splice(index, 1);
        notes.push(`Removed a bullet from ${label}`);
        break;
      }
      case "reorderBullets": {
        const owner = bulletOwners(p).find((o) => o.item.id === op.itemId);
        if (!owner) throw new EditError("That item no longer exists. Reload the page.");
        const current = owner.item.bullets.map((b) => b.id);
        if (op.order.length !== current.length || !op.order.every((id) => current.includes(id))) {
          throw new EditError("The bullets changed while you were moving them. Reload the page.");
        }
        owner.item.bullets.sort((a, b) => op.order.indexOf(a.id) - op.order.indexOf(b.id));
        notes.push(`Reordered bullets in ${owner.label}`);
        break;
      }
      case "addSkill": {
        const name = canonicalSkill(op.name);
        if (
          p.skills.some(
            (s) => skillFold(s.name) === skillFold(name) || s.aliases.some((a) => skillFold(a) === skillFold(name)),
          )
        ) {
          throw new EditError(`${name} is already in your skills.`);
        }
        p.skills.push({
          id: newId(`sk_${skillFold(name).replace(/[^a-z0-9]/g, "") || "skill"}`, allIds(p)),
          name,
          aliases: [],
          category: op.category,
          evidence: [],
          sources: ["user_added"],
        });
        notes.push(`Added ${name} to skills`);
        break;
      }
      case "removeSkill": {
        const i = p.skills.findIndex((s) => s.id === op.id);
        if (i < 0) throw new EditError("That skill no longer exists. Reload the page.");
        notes.push(`Removed ${p.skills[i].name} from skills`);
        p.skills.splice(i, 1);
        break;
      }
      case "resolveConflict": {
        const c = p.conflicts.find((x) => x.field === op.field);
        if (!c) throw new EditError("That conflict is already resolved.");
        if (!c.values.some((v) => v.value === op.value)) throw new EditError("Pick one of the listed values.");
        const [sec, id, attr] = op.field.split(".");
        if (sec === "basics") (p.basics as Record<string, unknown>)[id] = op.value;
        else {
          const list = (p as unknown as Record<string, { id: string }[]>)[sec];
          const item = list?.find((x) => x.id === id) as Record<string, unknown> | undefined;
          if (!item) throw new EditError("The item for this conflict no longer exists.");
          item[attr] = op.value;
        }
        p.conflicts = p.conflicts.filter((x) => x.field !== op.field);
        notes.push(`Resolved ${attr ?? id} for ${conflictLabel(profile, op.field)}`);
        break;
      }
      case "removePublication": {
        const i = p.publications.findIndex((x) => x.id === op.id);
        if (i < 0) throw new EditError("That publication no longer exists. Reload the page.");
        notes.push(`Removed ${p.publications[i].title}`);
        p.publications.splice(i, 1);
        break;
      }
      case "updateSectionItem":
      case "removeSectionItem": {
        const s = p.extraSections.find((x) => x.items.some((i) => i.id === op.id));
        if (!s) throw new EditError("That line no longer exists. Reload the page.");
        const i = s.items.findIndex((x) => x.id === op.id);
        if (op.op === "updateSectionItem") {
          s.items[i] = { ...s.items[i], text: op.text };
          notes.push(`Edited a line in ${s.title}`);
        } else {
          s.items.splice(i, 1);
          notes.push(`Removed a line from ${s.title}`);
        }
        p.extraSections = p.extraSections.filter((x) => x.items.length);
        break;
      }
      case "placeUnplaced":
      case "dismissUnplaced": {
        const u = p.unplaced.find((x) => x.id === op.id);
        if (!u) throw new EditError("That part of your CV was already handled. Reload the page.");
        p.unplaced = p.unplaced.filter((x) => x.id !== op.id);
        if (op.op === "placeUnplaced") {
          const id = newId("sec", allIds(p));
          const lines = u.text
            .split(/\n/)
            .map((l) => l.replace(/^\s*([-*\u2022]|\d+[.)])\s+/, "").trim())
            .filter(Boolean);
          p.extraSections.push({
            id,
            title: u.heading,
            items: lines.map((text, j) => ({ id: `${id}_${j + 1}`, text, sources: ["cv" as const] })),
          });
          notes.push(`Added ${u.heading} from your CV`);
        } else notes.push(`Set aside ${u.heading} from your CV`);
        break;
      }
    }
  }

  refreshEvidence(p);
  const checked = masterProfileSchema.safeParse(p);
  if (!checked.success) throw new EditError("That change would leave the profile incomplete. Nothing was saved.");
  return { profile: checked.data, notes };
}

/** "experience.exp_2.end" to "Taka Pay". */
export function conflictLabel(p: MasterProfile, field: string): string {
  const [sec, id] = field.split(".");
  if (sec === "basics") return "your details";
  const item = (p as unknown as Record<string, Record<string, string>[]>)[sec]?.find((x) => x.id === id);
  return item?.company ?? item?.name ?? item?.institution ?? sec;
}
