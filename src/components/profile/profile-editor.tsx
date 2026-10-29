"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  DotsSixVerticalIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/ssr";
import { Fragment, useState, type ReactNode } from "react";
import { Button } from "@/components/legacy/button";
import { TokenChip } from "@/components/legacy/chip";
import { Panel } from "@/components/legacy/feedback";
import { SourceBadges } from "@/components/legacy/form-bits";
import { Input, Label } from "@/components/legacy/input";
import { Select } from "@/components/legacy/select";
import { toast } from "sonner";
import { boldSegments } from "@/lib/cv/document";
import { formatCvDate } from "@/lib/profile/dates";
import type { EditOp } from "@/lib/profile/edit";
import type { Bullet, MasterProfile } from "@/lib/profile/schema";
import { useEditProfile, useRestoreVersion, type ProfileVersionDto } from "@/lib/query/profile";
import { cn } from "@/lib/utils";
import { ConflictsPanel } from "./conflicts";
import { EditableText } from "./editable-text";

type Section = "experience" | "projects" | "education" | "certifications";

const CATEGORY_LABEL: Record<string, string> = {
  language: "Languages",
  framework: "Frameworks",
  library: "Libraries",
  database: "Databases",
  cloud: "Cloud",
  tool: "Tools",
  practice: "Practices",
  domain: "Domains",
  soft: "Working style",
};

const FIELDS: Record<Section, { key: string; label: string; placeholder?: string }[]> = {
  experience: [
    { key: "company", label: "Company" },
    { key: "title", label: "Title" },
    { key: "start", label: "Start", placeholder: "Mar 2024" },
    { key: "end", label: "End", placeholder: "Present" },
    { key: "location", label: "Location" },
    { key: "companyUrl", label: "Company website", placeholder: "https://" },
  ],
  projects: [
    { key: "name", label: "Name" },
    { key: "description", label: "One-line description" },
    { key: "liveUrl", label: "Live link", placeholder: "https://" },
    { key: "sourceUrl", label: "Source link", placeholder: "https://" },
  ],
  education: [
    { key: "institution", label: "Institution" },
    { key: "degree", label: "Degree" },
    { key: "start", label: "Start", placeholder: "2015" },
    { key: "end", label: "End", placeholder: "2019" },
    { key: "location", label: "Location" },
  ],
  certifications: [
    { key: "name", label: "Name" },
    { key: "issuer", label: "Issuer" },
    { key: "date", label: "Date", placeholder: "2022" },
  ],
};

function Rich({ bullet }: { bullet: Bullet }) {
  return (
    <>
      {boldSegments(bullet.text, bullet.boldPhrases).map((s, i) =>
        s.bold ? (
          <b key={i} className="font-semibold">
            {s.text}
          </b>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}

function SectionHeading({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-10 flex items-end justify-between gap-4 border-b border-rule pb-2 first:mt-0">
      <h2 id={id} className="text-lg font-semibold">
        {children}
      </h2>
      {action}
    </div>
  );
}

function ItemForm({
  section,
  initial = {},
  onSubmit,
  onCancel,
  submitLabel,
}: {
  section: Section;
  initial?: Record<string, string | undefined>;
  onSubmit: (fields: Record<string, string>) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FIELDS[section].map((f) => {
        const v = initial[f.key] ?? "";
        return [f.key, f.key === "start" || f.key === "end" || f.key === "date" ? formatCvDate(v) : v];
      }),
    ),
  );
  return (
    <form
      className="my-3 rounded-panel border border-rule bg-ink-wash p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS[section].map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`${section}-${f.key}`}>{f.label}</Label>
            <Input
              id={`${section}-${f.key}`}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function BulletList({
  itemId,
  bullets,
  edit,
  label,
  itemSources,
}: {
  itemId: string;
  bullets: Bullet[];
  edit: (ops: EditOp[]) => void;
  label: string;
  /** A bullet shows its own sources only when they differ from its item's. */
  itemSources: string[];
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const order = bullets.map((b) => b.id);
  const move = (id: string, to: number) => {
    const next = order.filter((x) => x !== id);
    next.splice(to, 0, id);
    if (next.join() !== order.join()) edit([{ op: "reorderBullets", itemId, order: next }]);
  };

  return (
    <div className="mt-2">
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li
            key={b.id}
            draggable
            onDragStart={(e) => {
              setDragging(b.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging) move(dragging, i);
              setDragging(null);
            }}
            className={cn(
              "group relative grid grid-cols-[20px_1fr_auto] items-start gap-1 rounded-[6px]",
              dragging === b.id && "opacity-50",
            )}
          >
            <span
              className="mt-1.5 cursor-grab text-graphite opacity-60 group-hover:opacity-100"
              aria-hidden
              title="Drag to reorder"
            >
              <DotsSixVerticalIcon size={16} />
            </span>
            <div className="min-w-0 text-[15px] leading-6 text-body">
              <EditableText
                label={`bullet ${i + 1} in ${label}`}
                value={b.text}
                display={<Rich bullet={b} />}
                onSave={(text) => edit([{ op: "updateBullet", id: b.id, text }])}
              />
              {b.sources.join() !== itemSources.join() && <SourceBadges sources={b.sources} className="mt-0.5" />}
            </div>
            <div className="flex items-center opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move bullet ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(b.id, i - 1)}
              >
                <ArrowUpIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move bullet ${i + 1} down`}
                disabled={i === bullets.length - 1}
                onClick={() => move(b.id, i + 1)}
              >
                <ArrowDownIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove bullet ${i + 1}`}
                onClick={() => edit([{ op: "removeBullet", id: b.id }])}
              >
                <TrashIcon aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="mt-2 pl-6">
          <NewText
            label={`new bullet in ${label}`}
            onSave={(text) => (edit([{ op: "addBullet", itemId, text }]), setAdding(false))}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="mt-1 ml-5" onClick={() => setAdding(true)}>
          <PlusIcon aria-hidden />
          Add a bullet
        </Button>
      )}
    </div>
  );
}

function NewText({ label, onSave, onCancel }: { label: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        aria-label={label}
        value={text}
        placeholder="What you did, with what, and the result"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) onSave(text.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ItemHeader({
  left,
  sub,
  right,
  sources,
  onEdit,
  onRemove,
  label,
}: {
  left: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  sources: string[];
  onEdit: () => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="group flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <p className="text-base">
          <span className="font-semibold text-ink">{left}</span>
          {sub && <span className="text-body"> | {sub}</span>}
        </p>
        <SourceBadges sources={sources} className="mt-1" />
      </div>
      <div className="flex items-center gap-1">
        {right && <span className="mr-2 text-sm text-graphite italic">{right}</span>}
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${label}`} onClick={onEdit}>
          <PencilSimpleIcon aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove}>
          <TrashIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function dates(start?: string, end?: string) {
  if (!start && !end) return undefined;
  return [formatCvDate(start), formatCvDate(end)].filter(Boolean).join(" to ");
}

/**
 * The master profile as a document that reads like a CV, on a white index
 * card. Every item shows where it came from; everything edits in place and
 * each change is saved as a new version.
 */
export function ProfileEditor({ version }: { version: ProfileVersionDto }) {
  const p = version.data;
  const restore = useRestoreVersion();
  const editMut = useEditProfile();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<Section | null>(null);
  const [skillDraft, setSkillDraft] = useState("");
  const [skillCat, setSkillCat] = useState("tool");

  const edit = (ops: EditOp[]) => editMut.mutate(ops);
  /** Removals save a version; Undo restores the version before it. */
  const remove = (op: EditOp, what: string) =>
    editMut.mutate([op], {
      onSuccess: (saved) =>
        toast(`Removed ${what}.`, { action: { label: "Undo", onClick: () => restore.mutate(saved.version - 1) } }),
    });

  const sectionItems = (section: Section, label: (x: Record<string, unknown>) => string) => (
    <>
      {(p[section] as unknown as (Record<string, unknown> & { id: string; sources: string[] })[]).map((item) => {
        const key = `${section}:${item.id}`;
        if (editing === key) {
          return (
            <ItemForm
              key={item.id}
              section={section}
              initial={item as Record<string, string | undefined>}
              submitLabel="Save"
              onCancel={() => setEditing(null)}
              onSubmit={(fields) => {
                edit([{ op: "updateItem", section, id: item.id, fields }]);
                setEditing(null);
              }}
            />
          );
        }
        const name = label(item);
        return (
          <article key={item.id} className="mt-5" aria-label={name}>
            <ItemHeader
              label={name}
              left={
                section === "experience"
                  ? (item.company as string)
                  : section === "projects"
                    ? (item.name as string)
                    : section === "education"
                      ? (item.institution as string)
                      : (item.name as string)
              }
              sub={
                section === "experience"
                  ? (item.title as string)
                  : section === "education"
                    ? (item.degree as string)
                    : section === "certifications"
                      ? (item.issuer as string | undefined)
                      : (item.description as string) || undefined
              }
              right={
                section === "certifications"
                  ? formatCvDate(item.date as string)
                  : dates(item.start as string, item.end as string)
              }
              sources={item.sources}
              onEdit={() => setEditing(key)}
              onRemove={() => remove({ op: "removeItem", section, id: item.id }, name)}
            />
            {(section === "experience" || section === "projects") && (
              <>
                <BulletList
                  itemId={item.id}
                  bullets={item.bullets as Bullet[]}
                  edit={edit}
                  label={name}
                  itemSources={item.sources}
                />
                {(item.tech as string[]).length > 0 && (
                  <p className="mt-1 pl-6 text-sm text-body">
                    <span className="font-medium">Tech:</span> <i>{(item.tech as string[]).join(", ")}</i>
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}
      {adding === section ? (
        <ItemForm
          section={section}
          submitLabel="Add"
          onCancel={() => setAdding(null)}
          onSubmit={(fields) => {
            edit([{ op: "addItem", section, fields }]);
            setAdding(null);
          }}
        />
      ) : null}
    </>
  );

  const skillsByCat = Object.entries(
    p.skills.reduce<Record<string, MasterProfile["skills"]>>((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {}),
  ).sort((a, b) => Object.keys(CATEGORY_LABEL).indexOf(a[0]) - Object.keys(CATEGORY_LABEL).indexOf(b[0]));

  const addButton = (section: Section, text: string) => (
    <Button variant="ghost" size="sm" onClick={() => setAdding(section)}>
      <PlusIcon aria-hidden />
      {text}
    </Button>
  );

  return (
    <div className="space-y-6">
      <ConflictsPanel profile={p} onResolve={(op) => edit([op])} pending={editMut.isPending} />

      <Panel className="px-5 pt-8 pb-10 md:px-10">
        {/* Header, like the top of a CV */}
        {editing === "basics" ? (
          <BasicsForm
            profile={p}
            onCancel={() => setEditing(null)}
            onSave={(fields) => (edit([{ op: "setBasics", fields }]), setEditing(null))}
          />
        ) : (
          <header className="group flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">{p.basics.name}</h1>
              {p.basics.headline && <p className="mt-0.5 text-lg text-body">{p.basics.headline}</p>}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-graphite">
                {[p.basics.location, p.basics.email, p.basics.phone].filter(Boolean).map((x) => (
                  <span key={x}>{x}</span>
                ))}
                {p.basics.links.map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.label}
                  </a>
                ))}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing("basics")}>
              <PencilSimpleIcon aria-hidden />
              Edit details
            </Button>
          </header>
        )}

        <SectionHeading id="summary-h">Summary</SectionHeading>
        <div className="mt-3 text-[15px] leading-6 text-body">
          <EditableText
            label="summary"
            value={p.basics.summary?.text ?? ""}
            placeholder="Add a short summary"
            onSave={(text) => edit([{ op: "setSummary", text }])}
          />
          {p.basics.summary && <SourceBadges sources={p.basics.summary.sources} className="mt-1" />}
        </div>

        <SectionHeading id="exp-h" action={addButton("experience", "Add a role")}>
          Experience
        </SectionHeading>
        {sectionItems("experience", (x) => `${x.title} at ${x.company}`)}

        <SectionHeading id="proj-h" action={addButton("projects", "Add a project")}>
          Projects
        </SectionHeading>
        {sectionItems("projects", (x) => String(x.name))}

        <SectionHeading id="edu-h" action={addButton("education", "Add education")}>
          Education
        </SectionHeading>
        {sectionItems("education", (x) => String(x.institution))}

        <SectionHeading id="skills-h">Skills</SectionHeading>
        <dl className="mt-3 space-y-3">
          {skillsByCat.map(([cat, skills]) => (
            <div key={cat} className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[140px_1fr]">
              <dt className="pt-1.5 text-sm text-graphite">{CATEGORY_LABEL[cat] ?? cat}</dt>
              <dd className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <TokenChip
                    key={s.id}
                    onRemove={() => remove({ op: "removeSkill", id: s.id }, s.name)}
                    className={cn(s.evidence.length === 0 && "border-dashed")}
                  >
                    <span
                      title={
                        s.evidence.length === 0
                          ? "Listed only: no bullet or project mentions it"
                          : `Shown in ${s.evidence.length} place${s.evidence.length === 1 ? "" : "s"}`
                      }
                    >
                      {s.name}
                    </span>
                  </TokenChip>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-graphite">
          A dashed border means the skill is listed but no bullet or project mentions it yet.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!skillDraft.trim()) return;
            edit([
              {
                op: "addSkill",
                name: skillDraft.trim(),
                category: skillCat as MasterProfile["skills"][number]["category"],
              },
            ]);
            setSkillDraft("");
          }}
        >
          <div className="w-full space-y-1 sm:w-56">
            <Label htmlFor="new-skill">Add a skill</Label>
            <Input
              id="new-skill"
              value={skillDraft}
              placeholder="GraphQL"
              onChange={(e) => setSkillDraft(e.target.value)}
            />
          </div>
          <Select
            aria-label="Skill category"
            value={skillCat}
            onValueChange={setSkillCat}
            options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
            className="w-full sm:w-44"
          />
          <Button type="submit" variant="secondary" disabled={!skillDraft.trim()}>
            <PlusIcon aria-hidden />
            Add
          </Button>
        </form>

        <SectionHeading id="cert-h" action={addButton("certifications", "Add a certification")}>
          Certifications
        </SectionHeading>
        {p.certifications.length === 0 && adding !== "certifications" && (
          <p className="mt-3 text-sm text-graphite">None yet.</p>
        )}
        {sectionItems("certifications", (x) => String(x.name))}

        {p.languages.length > 0 && (
          <>
            <SectionHeading id="lang-h">Languages</SectionHeading>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-body">
              {p.languages.map((l) => (
                <li key={l.id}>
                  {l.name}
                  {l.level && <span className="text-graphite"> ({l.level})</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function BasicsForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: MasterProfile;
  onSave: (f: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({
    name: profile.basics.name,
    headline: profile.basics.headline ?? "",
    location: profile.basics.location ?? "",
    email: profile.basics.email ?? "",
    phone: profile.basics.phone ?? "",
  });
  const fields: [keyof typeof v, string][] = [
    ["name", "Name on your CV"],
    ["headline", "Headline"],
    ["location", "Location"],
    ["email", "Email"],
    ["phone", "Phone"],
  ];
  return (
    <form
      className="rounded-panel border border-rule bg-ink-wash p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`basics-${k}`}>{label}</Label>
            <Input id={`basics-${k}`} value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={!v.name.trim()}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
