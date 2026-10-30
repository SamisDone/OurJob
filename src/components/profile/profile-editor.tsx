"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SourceBadges } from "@/components/forms/source-badges";
import { Nums } from "@/components/nums";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type FieldSpec = { key: string; label: string; placeholder?: string; url?: boolean };

const FIELDS: Record<Section, FieldSpec[]> = {
  experience: [
    { key: "company", label: "Company" },
    { key: "title", label: "Title" },
    { key: "start", label: "Start", placeholder: "Mar 2024" },
    { key: "end", label: "End", placeholder: "Present" },
    { key: "location", label: "Location" },
    { key: "companyUrl", label: "Company website", placeholder: "https://", url: true },
  ],
  projects: [
    { key: "name", label: "Name" },
    { key: "description", label: "One-line description" },
    { key: "liveUrl", label: "Live link", placeholder: "https://", url: true },
    { key: "sourceUrl", label: "Source link", placeholder: "https://", url: true },
  ],
  education: [
    { key: "institution", label: "Institution" },
    { key: "degree", label: "Degree" },
    { key: "start", label: "Start", placeholder: "2015" },
    { key: "end", label: "End", placeholder: "2019" },
    { key: "location", label: "Location" },
    { key: "grade", label: "Grade", placeholder: "CGPA 3.70/4.00" },
  ],
  certifications: [
    { key: "name", label: "Name" },
    { key: "issuer", label: "Issuer" },
    { key: "date", label: "Date", placeholder: "2022" },
  ],
};

/** The first field names the item, so it is the one that cannot be empty. */
function itemSchema(section: Section) {
  return z.object(
    Object.fromEntries(
      FIELDS[section].map((f, i) => [
        f.key,
        i === 0
          ? z.string().trim().min(1, `Add the ${f.label.toLowerCase()}.`)
          : f.url
            ? z
                .string()
                .trim()
                .refine((s) => s === "" || /^https?:\/\/\S+$/i.test(s), "Enter a full link starting with https://")
            : z.string(),
      ]),
    ),
  );
}

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

function SectionCard({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle>
          <h2 id={id}>{title}</h2>
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FormButtons({
  submitLabel,
  onCancel,
  disabled,
}: {
  submitLabel: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={disabled}>
        {submitLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
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
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(itemSchema(section)),
    defaultValues: Object.fromEntries(
      FIELDS[section].map((f) => {
        const v = initial[f.key] ?? "";
        return [f.key, f.key === "start" || f.key === "end" || f.key === "date" ? formatCvDate(v) : v];
      }),
    ),
  });
  return (
    <form
      className="my-3 rounded-lg border bg-muted/40 p-4"
      noValidate
      onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
    >
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS[section].map((f) => (
            <Controller
              key={f.key}
              name={f.key}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${section}-${f.key}`}>{f.label}</FieldLabel>
                  <Input
                    {...field}
                    id={`${section}-${f.key}`}
                    placeholder={f.placeholder}
                    aria-invalid={fieldState.invalid || undefined}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ))}
        </div>
        <FormButtons submitLabel={submitLabel} onCancel={onCancel} />
      </FieldGroup>
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
              "group relative grid grid-cols-[20px_1fr_auto] items-start gap-1 rounded-md",
              dragging === b.id && "opacity-50",
            )}
          >
            <span
              className="mt-1 cursor-grab text-muted-foreground opacity-60 group-hover:opacity-100"
              aria-hidden
              title="Drag to reorder"
            >
              <GripVertical className="size-4" />
            </span>
            <div className="min-w-0 text-sm leading-6">
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
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move bullet ${i + 1} down`}
                disabled={i === bullets.length - 1}
                onClick={() => move(b.id, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove bullet ${i + 1}`}
                onClick={() => edit([{ op: "removeBullet", id: b.id }])}
              >
                <Trash2 />
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
          <Plus data-icon="inline-start" />
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
  right?: string;
  sources: string[];
  onEdit: () => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <p>
          <span className="font-semibold">{left}</span>
          {sub && <span className="text-muted-foreground"> · {sub}</span>}
        </p>
        <SourceBadges sources={sources} className="mt-1" />
      </div>
      <div className="flex items-center gap-1">
        {right && (
          <span className="mr-2 text-sm text-muted-foreground">
            <Nums>{right}</Nums>
          </span>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${label}`} onClick={onEdit}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove}>
          <Trash2 />
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
 * The master profile, one card per section in CV order. Every item shows
 * where it came from; everything edits in place and each change is saved as
 * a new version.
 */
export function ProfileEditor({ version }: { version: ProfileVersionDto }) {
  const p = version.data;
  const restore = useRestoreVersion();
  const editMut = useEditProfile();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<Section | null>(null);

  const edit = (ops: EditOp[]) => editMut.mutate(ops);
  /** Removals save a version; Undo restores the version before it. */
  const remove = (op: EditOp, what: string) =>
    editMut.mutate([op], {
      onSuccess: (saved) =>
        toast(`Removed ${what}.`, { action: { label: "Undo", onClick: () => restore.mutate(saved.version - 1) } }),
    });

  const sectionItems = (section: Section, label: (x: Record<string, unknown>) => string) => (
    <div className="divide-y">
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
          <article key={item.id} className="py-4 first:pt-0 last:pb-0" aria-label={name}>
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
                    ? [item.degree as string, item.grade as string | undefined].filter(Boolean).join(", ")
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
                  <p className="mt-1 pl-6 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Tech:</span> {(item.tech as string[]).join(", ")}
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
    </div>
  );

  const skillsByCat = Object.entries(
    p.skills.reduce<Record<string, MasterProfile["skills"]>>((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {}),
  ).sort((a, b) => Object.keys(CATEGORY_LABEL).indexOf(a[0]) - Object.keys(CATEGORY_LABEL).indexOf(b[0]));

  const addButton = (section: Section, text: string) => (
    <Button variant="outline" size="sm" onClick={() => setAdding(section)}>
      <Plus data-icon="inline-start" />
      {text}
    </Button>
  );

  return (
    <div className="space-y-6">
      <ConflictsPanel profile={p} onResolve={(op) => edit([op])} pending={editMut.isPending} />
      <UnplacedPanel profile={p} edit={edit} pending={editMut.isPending} />

      <Card role="region" aria-labelledby="basics-h">
        <CardContent>
          {editing === "basics" ? (
            <BasicsForm
              profile={p}
              onCancel={() => setEditing(null)}
              onSave={(fields) => (edit([{ op: "setBasics", fields }]), setEditing(null))}
            />
          ) : (
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="basics-h" className="text-xl font-semibold tracking-tight">
                  {p.basics.name}
                </h2>
                {p.basics.headline && <p className="mt-0.5 text-muted-foreground">{p.basics.headline}</p>}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {[p.basics.location, p.basics.email, p.basics.phone].filter(Boolean).map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                  {p.basics.links.map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      className="text-foreground underline underline-offset-4 hover:text-muted-foreground"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.label}
                    </a>
                  ))}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing("basics")}>
                <Pencil data-icon="inline-start" />
                Edit details
              </Button>
            </header>
          )}
          <div className="mt-6 border-t pt-4 text-sm leading-6">
            <p id="summary-h" className="mb-1 font-medium">
              Summary
            </p>
            <EditableText
              label="summary"
              value={p.basics.summary?.text ?? ""}
              placeholder="Add a short summary"
              onSave={(text) => edit([{ op: "setSummary", text }])}
            />
            {p.basics.summary && <SourceBadges sources={p.basics.summary.sources} className="mt-1" />}
          </div>
        </CardContent>
      </Card>

      <SectionCard id="exp-h" title="Experience" action={addButton("experience", "Add a role")}>
        {sectionItems("experience", (x) => `${x.title} at ${x.company}`)}
      </SectionCard>

      <SectionCard id="proj-h" title="Projects" action={addButton("projects", "Add a project")}>
        {sectionItems("projects", (x) => String(x.name))}
      </SectionCard>

      <SectionCard id="edu-h" title="Education" action={addButton("education", "Add education")}>
        {sectionItems("education", (x) => String(x.institution))}
      </SectionCard>

      <SectionCard id="skills-h" title="Skills">
        <dl className="space-y-3">
          {skillsByCat.map(([cat, skills]) => (
            <div key={cat} className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[140px_1fr]">
              <dt className="pt-1 text-sm text-muted-foreground">{CATEGORY_LABEL[cat] ?? cat}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className={cn("h-7 gap-1 pr-1 text-sm font-normal", s.evidence.length === 0 && "border-dashed")}
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
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-6 rounded-full"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => remove({ op: "removeSkill", id: s.id }, s.name)}
                    >
                      <X />
                    </Button>
                  </Badge>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          A dashed border means the skill is listed but no bullet or project mentions it yet.
        </p>
        <SkillForm onAdd={(name, category) => edit([{ op: "addSkill", name, category }])} />
      </SectionCard>

      <SectionCard id="cert-h" title="Certifications" action={addButton("certifications", "Add a certification")}>
        {p.certifications.length === 0 && adding !== "certifications" && (
          <p className="text-sm text-muted-foreground">None yet.</p>
        )}
        {sectionItems("certifications", (x) => String(x.name))}
      </SectionCard>

      {p.publications.length > 0 && (
        <SectionCard id="pub-h" title="Publications">
          <ul className="divide-y">
            {p.publications.map((x) => (
              <li key={x.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{x.title}</p>
                  <p className="text-muted-foreground">
                    <Nums>{[x.venue, formatCvDate(x.date)].filter(Boolean).join(", ")}</Nums>
                  </p>
                  <SourceBadges sources={x.sources} className="mt-1" />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${x.title}`}
                  onClick={() => remove({ op: "removePublication", id: x.id }, x.title)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {p.extraSections.map((s) => (
        <SectionCard key={s.id} id={`${s.id}-h`} title={s.title}>
          <ul className="space-y-1">
            {s.items.map((it, i) => (
              <li key={it.id} className="group grid grid-cols-[1fr_auto] items-start gap-1 text-sm leading-6">
                <EditableText
                  label={`line ${i + 1} in ${s.title}`}
                  value={it.text}
                  onSave={(text) => edit([{ op: "updateSectionItem", id: it.id, text }])}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove line ${i + 1} from ${s.title}`}
                  onClick={() => remove({ op: "removeSectionItem", id: it.id }, `a line from ${s.title}`)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}

      {p.languages.length > 0 && (
        <SectionCard id="lang-h" title="Languages">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {p.languages.map((l) => (
              <li key={l.id}>
                {l.name}
                {l.level && <span className="text-muted-foreground"> ({l.level})</span>}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

/**
 * Parts of his CV that extraction did not place anywhere (src/lib/profile/coverage.ts).
 * Shown until he keeps each one as a section or sets it aside: nothing is dropped silently.
 */
function UnplacedPanel({
  profile,
  edit,
  pending,
}: {
  profile: MasterProfile;
  edit: (ops: EditOp[]) => void;
  pending: boolean;
}) {
  if (!profile.unplaced.length) return null;
  return (
    <Alert variant="warning" role="region" aria-labelledby="unplaced-h">
      <TriangleAlert />
      <AlertTitle>
        <h2 id="unplaced-h">Some parts of your CV are not in your profile yet</h2>
      </AlertTitle>
      <AlertDescription>
        <p>Keep each one as its own section, or set it aside. Tailoring only uses what is in your profile.</p>
        <ul className="mt-2 w-full divide-y divide-warning/20">
          {profile.unplaced.map((u) => (
            <li key={u.id} className="py-3">
              <p className="font-medium text-foreground">{u.heading}</p>
              <p className="mt-1 text-sm whitespace-pre-line">{u.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => edit([{ op: "placeUnplaced", id: u.id }])}
                >
                  Add as a section
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => edit([{ op: "dismissUnplaced", id: u.id }])}
                >
                  Set aside
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

type SkillCategory = MasterProfile["skills"][number]["category"];

const skillSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string(),
});

function SkillForm({ onAdd }: { onAdd: (name: string, category: SkillCategory) => void }) {
  const form = useForm<z.infer<typeof skillSchema>>({
    resolver: zodResolver(skillSchema),
    defaultValues: { name: "", category: "tool" },
  });
  const name = useWatch({ control: form.control, name: "name" });
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={(e) =>
        void form.handleSubmit((v) => {
          onAdd(v.name, v.category as SkillCategory);
          form.reset({ name: "", category: v.category });
        })(e)
      }
    >
      <Field className="w-full sm:w-56">
        <FieldLabel htmlFor="new-skill">Add a skill</FieldLabel>
        <Input id="new-skill" placeholder="GraphQL" {...form.register("name")} />
      </Field>
      <Controller
        name="category"
        control={form.control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger aria-label="Skill category" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <Button type="submit" variant="outline" disabled={!name.trim()}>
        <Plus data-icon="inline-start" />
        Add
      </Button>
    </form>
  );
}

const basicsSchema = z.object({
  name: z.string().trim().min(1, "Add the name on your CV."),
  headline: z.string(),
  location: z.string(),
  email: z.union([z.literal(""), z.email("Enter an email like name@example.com.")]),
  phone: z.string(),
});
type Basics = z.infer<typeof basicsSchema>;

const BASICS_FIELDS: [keyof Basics, string][] = [
  ["name", "Name on your CV"],
  ["headline", "Headline"],
  ["location", "Location"],
  ["email", "Email"],
  ["phone", "Phone"],
];

function BasicsForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: MasterProfile;
  onSave: (f: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const form = useForm<Basics>({
    resolver: zodResolver(basicsSchema),
    defaultValues: {
      name: profile.basics.name,
      headline: profile.basics.headline ?? "",
      location: profile.basics.location ?? "",
      email: profile.basics.email ?? "",
      phone: profile.basics.phone ?? "",
    },
  });
  return (
    <form noValidate onSubmit={(e) => void form.handleSubmit(onSave)(e)}>
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {BASICS_FIELDS.map(([k, label]) => (
            <Controller
              key={k}
              name={k}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`basics-${k}`}>{label}</FieldLabel>
                  <Input
                    {...field}
                    id={`basics-${k}`}
                    type={k === "email" ? "email" : "text"}
                    aria-invalid={fieldState.invalid || undefined}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ))}
        </div>
        <FormButtons submitLabel="Save" onCancel={onCancel} />
      </FieldGroup>
    </form>
  );
}
