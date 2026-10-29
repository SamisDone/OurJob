"use client";

import { ArrowSquareOutIcon, CaretDownIcon, CopyIcon, DownloadSimpleIcon, PlusIcon } from "@phosphor-icons/react/ssr";
import { useMemo, useState, type ReactNode } from "react";
import { CvPreview } from "@/components/cv/cv-preview";
import { CvSheet } from "@/components/cv/cv-sheet";
import { JobRow, JobRowSkeleton } from "@/components/jobs/job-row";
import { MarkedText } from "@/components/marks/marked-text";
import { penTiming } from "@/components/marks/sweep";
import { ScoreDisplay } from "@/components/score/score";
import { AppShell } from "@/components/shell/app-shell";
import { AccountMenu } from "@/components/shell/account-menu";
import { Kbd } from "@/components/shell/command-palette";
import { ThemeControl } from "@/components/shell/theme-control";
import { TailorDesk } from "@/components/tailor/desk";
import { KanbanBoard, KanbanCard, KanbanColumn } from "@/components/tracker/kanban";
import { Button } from "@/components/ui/button";
import { FilterChip, KeywordChip, Stamp, Tag, TokenChip } from "@/components/ui/chip";
import { CodeView } from "@/components/ui/code-view";
import { DataTable } from "@/components/ui/data-table";
import { DiffView } from "@/components/ui/diff-view";
import { Callout, CautionBar, EmptyState, ErrorState, Panel, Skeleton } from "@/components/ui/feedback";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  Tooltip,
  TooltipProvider,
} from "@/components/ui/overlay";
import { Combobox, Select } from "@/components/ui/select";
import { ProgressSteps, TaskSteps } from "@/components/ui/steps";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import type { CvDocument } from "@/lib/cv/document";
import { findSampleMarks, sampleAts, sampleCompanies, sampleCv, sampleJd, sampleJobs } from "@/lib/design/sample";
import { cn } from "@/lib/utils";

const lightTokens = [
  ["paper", "#E6E4DF", "The desk the cards sit on"],
  ["sheet", "#FFFFFF", "Index cards, panels, popovers"],
  ["ink", "#1F3A93", "Headings, titles, fit score, primary buttons, links"],
  ["body", "#2A3145", "Running text: descriptions, bullets, reasons"],
  ["graphite", "#4F5D80", "Secondary text: company, source, dates, hints"],
  ["rule", "#C9D8F0", "Ruled lines between rows, borders"],
  ["control-edge", "#6F7EA5", "Edges of text fields and selects"],
  ["red-rule", "#D7263D", "The red line at the top of a card. Never text"],
  ["redpen", "#C41E3A", "Missing keywords, destructive actions, the stamp"],
  ["circle-fill", "#DCE6FA", "Behind a circled keyword, focus halo"],
  ["circle-stroke", "#1F3A93", "The blue pen circle"],
  ["ok", "#186A41", "Eligible, passed checks"],
  ["caution", "#8A5100", "Pipeline warnings, eligibility unclear"],
] as const;
const darkHex: Record<string, string> = {
  paper: "#10162A",
  sheet: "#182039",
  ink: "#DCE4F7",
  body: "#C9D0E0",
  graphite: "#9AA6C4",
  rule: "#2A3557",
  "control-edge": "#6878A6",
  "red-rule": "#FF6B7A",
  redpen: "#FF6B7A",
  "circle-fill": "#2A3A6E",
  "circle-stroke": "#8FB0FF",
  ok: "#5CC48A",
  caution: "#F0A63C",
};

const latexExcerpt = String.raw`%-----------EXPERIENCE-----------
\section{Professional Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {\lnk{https://example.com/brightfield}{Brightfield Software}}{Full-Stack Engineer}{Mar 2024 -- Present}
      \resumeItemListStart
        \resumeItem{Built the \textbf{real-time shipment dashboard} used by \textbf{40 client teams}, moving live order updates from REST polling to WebSockets; cut the main bundle size by \textbf{35\%} through route splitting.}
        \tech{React, TypeScript, Node.js, PostgreSQL, Redis, WebSockets, Docker}
      \resumeItemListEnd

  \resumeSubHeadingListEnd`;

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 border-t border-rule pt-8 pb-14">
      <h2 id={`${id}-h`} className="text-xl font-semibold text-ink">
        {title}
      </h2>
      {intro && <p className="mt-1 measure text-graphite">{intro}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Sub({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-3 text-sm font-medium text-graphite">{title}</h3>
      {children}
    </div>
  );
}

function TokenPanel({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      data-theme={theme}
      className="red-rule-top relative overflow-hidden rounded-panel border border-rule bg-paper text-body"
    >
      <div className="flex items-baseline justify-between border-b border-rule bg-sheet px-4 py-3">
        <span className="font-medium text-ink">{theme === "light" ? "Light" : "Dark, carbon paper"}</span>
        <span className="text-sm text-graphite">tokens.css</span>
      </div>
      <ul className="divide-y divide-rule">
        {lightTokens.map(([name, light, use]) => (
          <li key={name} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className="size-8 shrink-0 rounded-control border border-rule"
              style={{ background: `var(--${name})` }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">--{name}</span>
              <span className="block truncate text-xs text-graphite">{use}</span>
            </span>
            <span className="text-sm text-graphite tabular">{theme === "light" ? light : darkHex[name]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProofingDesk({ cv }: { cv: CvDocument }) {
  const marks = useMemo(() => findSampleMarks(sampleJd.text, sampleJd.matched, sampleJd.missing), []);
  const [phase, setPhase] = useState<"static" | "pending" | "run">("static");
  const [run, setRun] = useState(0);
  const timing = penTiming(marks.filter((m) => m.kind === "matched").length);

  const replay = () => {
    setPhase("pending");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setPhase("run");
        setRun((r) => r + 1);
      }),
    );
  };

  const diff = (
    <DiffView
      items={[
        {
          kind: "rewritten",
          where: "Brightfield Software",
          before: "Built a dashboard for shipments with live updates.",
          after:
            "Built the real-time shipment dashboard used by 40 client teams, moving live order updates from REST polling to WebSockets.",
        },
        {
          kind: "moved",
          where: "Projects",
          text: "Queue Lite",
          note: "Moved above Ledgerly: closer to their Node.js API work",
        },
        {
          kind: "dropped",
          where: "Kite & Co. Digital",
          text: "Managed hosting renewals for client sites.",
          reason: "Does not help this job",
        },
      ]}
    />
  );

  return (
    <TailorDesk
      job={
        <>
          <p className="text-lg font-semibold text-ink">{sampleJd.title}</p>
          <p className="mb-4 text-sm text-graphite">at {sampleJd.company}</p>
          <MarkedText text={sampleJd.text} marks={marks} phase={phase} />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={replay}>
              Replay the pen
            </Button>
            <span className="text-sm text-graphite">
              The pen takes {Math.round(timing.totalMs)} ms, {Math.round(timing.staggerMs)} ms between circles.
            </span>
          </div>
        </>
      }
      cv={
        <Tabs defaultValue="preview">
          <TabsList aria-label="CV view">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="latex">LaTeX</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
          </TabsList>
          <TabsContent value="preview">
            <CvPreview doc={cv} />
          </TabsContent>
          <TabsContent value="latex">
            <CodeView code={latexExcerpt} />
          </TabsContent>
          <TabsContent value="changes">{diff}</TabsContent>
        </Tabs>
      }
      scoreSummary={
        <>
          <span className="font-medium text-ink">Estimated ATS match</span>{" "}
          <span className="text-lg font-semibold text-ink tabular">{sampleAts.tailored}</span>
          <span className="text-graphite">
            , master CV <span className="tabular">{sampleAts.master}</span>
          </span>
        </>
      }
      score={
        <div className="space-y-8">
          <ScoreDisplay
            key={run}
            score={sampleAts.tailored}
            masterScore={sampleAts.master}
            components={sampleAts.components}
            animate={phase === "run"}
            durationMs={timing.totalMs}
          />
          <div>
            <h3 className="text-sm font-medium text-ink">
              Matched <span className="text-graphite tabular">({sampleJd.matched.length})</span>
            </h3>
            <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
              {sampleJd.matched.map((k) => (
                <KeywordChip key={k} kind="matched">
                  {k}
                </KeywordChip>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-ink">
              Missing <span className="text-graphite tabular">({sampleJd.missing.length})</span>
            </h3>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {sampleJd.missing.map((k, i) => (
                <li key={k} className="flex items-center justify-between gap-2 py-2">
                  <KeywordChip kind="missing" importance={i < 3 ? "must" : "nice"}>
                    {k}
                  </KeywordChip>
                  <IHaveThis term={k} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      actions={
        <>
          <Button onClick={() => toast("Opened in Overleaf in a new tab.")}>
            <ArrowSquareOutIcon aria-hidden />
            Open in Overleaf
          </Button>
          <div className="flex gap-2 [&>*]:flex-1">
            <Button variant="secondary" onClick={() => toast("Copied LaTeX.")}>
              Copy LaTeX
            </Button>
            <Button variant="secondary" aria-label="Download .tex">
              <DownloadSimpleIcon aria-hidden />
              .tex
            </Button>
          </div>
        </>
      }
      mobileActions={
        <>
          <Button onClick={() => toast("Opened in Overleaf in a new tab.")}>
            <ArrowSquareOutIcon aria-hidden />
            Open in Overleaf
          </Button>
          <Button variant="secondary" size="icon" aria-label="Copy LaTeX" onClick={() => toast("Copied LaTeX.")}>
            <CopyIcon aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Download .tex">
            <DownloadSimpleIcon aria-hidden />
          </Button>
        </>
      }
    />
  );
}

function IHaveThis({ term }: { term: string }) {
  const [where, setWhere] = useState<string>();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          I have this
        </Button>
      </SheetTrigger>
      <SheetContent
        title={`Where have you used ${term}?`}
        description="This goes into your master profile as added by you. Then the CV is tailored again."
        footer={
          <>
            <Button variant="ghost">Not for this job</Button>
            <Button>Add and re-tailor</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="where">Role or project</Label>
            <Select
              id="where"
              value={where}
              onValueChange={setWhere}
              placeholder="Choose a role or project"
              options={[
                { value: "exp_1", label: "Full-Stack Engineer, Brightfield Software" },
                { value: "exp_2", label: "Web Developer, Kite & Co. Digital" },
                { value: "proj_1", label: "Ledgerly (project)" },
                { value: "proj_2", label: "Queue Lite (project)" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="how">How you used it</Label>
            <Input id="how" placeholder={`One line, for example: Built the ${term} schema for order search`} />
            <FieldHint>Required. Only facts you can talk about in an interview.</FieldHint>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TodayPreview({ firstName }: { firstName: string }) {
  const [chips, setChips] = useState({ remote: true, pay: false, direct: false });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-2xl font-semibold text-ink">Good morning, {firstName}</p>
          <p className="mt-1 text-lg text-body">24 new remote jobs that fit you</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-graphite">
          <span>Last checked at 6:32, 412 companies</span>
          <Button variant="secondary" size="sm">
            Run now
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filters">
        <FilterChip menu>Fit</FilterChip>
        <FilterChip pressed={chips.remote} onClick={() => setChips((c) => ({ ...c, remote: !c.remote }))}>
          Remote: worldwide + Asia
        </FilterChip>
        <FilterChip pressed={chips.pay} onClick={() => setChips((c) => ({ ...c, pay: !c.pay }))}>
          Pay listed
        </FilterChip>
        <FilterChip pressed={chips.direct} onClick={() => setChips((c) => ({ ...c, direct: !c.direct }))}>
          Direct only
        </FilterChip>
        <FilterChip menu>Seniority</FilterChip>
      </div>

      <Panel className="mt-6" aria-labelledby="new-h">
        <h3 id="new-h" className="border-b border-rule px-4 pt-4 pb-3 text-sm font-medium text-graphite md:px-6">
          New since yesterday
        </h3>
        {sampleJobs.map((job, i) => (
          <JobRow
            key={job.id}
            job={job}
            defaultOpen={i === 0}
            onDismiss={() => toast("Dismissed.", { action: { label: "Undo", onClick: () => toast("Restored.") } })}
            onSave={() => toast("Saved to Tracker.", { action: { label: "Undo", onClick: () => {} } })}
            onApplied={() => toast("Marked as applied.", { action: { label: "Undo", onClick: () => {} } })}
          />
        ))}
        <JobRowSkeleton />
      </Panel>

      <details className="group red-rule-top relative mt-6 rounded-panel border border-rule bg-sheet px-4 md:px-6">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between pt-0.5 text-sm font-medium text-ink">
          <span>
            Eligibility unclear <span className="text-graphite tabular">(7)</span>
          </span>
          <CaretDownIcon
            size={16}
            aria-hidden
            className="text-graphite transition-transform duration-200 ease-ink group-open:rotate-180"
          />
        </summary>
        <p className="mb-4 measure border-l-2 border-caution pl-3 text-sm text-body">
          These say remote but do not say where you can work from. They are kept apart so you can check each one.
        </p>
      </details>
    </div>
  );
}

export type Viewer = { name: string; email: string } | null;

/** Puts the signed-in person's name on the sample. Nothing about them is stored or committed. */
function personalize(viewer: Viewer): { cv: CvDocument; firstName: string; label: string } {
  if (!viewer) return { cv: sampleCv, firstName: "Arif", label: "Arif Rahman (sample)" };
  const contact = sampleCv.contact.map((c) =>
    c.url?.startsWith("mailto:") ? { text: viewer.email, url: `mailto:${viewer.email}` } : c,
  );
  return {
    cv: { ...sampleCv, name: viewer.name, contact },
    firstName: viewer.name.split(/\s+/)[0],
    label: viewer.name,
  };
}

export function StyleTile({ viewer }: { viewer: Viewer }) {
  const { cv, firstName, label } = personalize(viewer);
  const [country, setCountry] = useState("BD");
  const [scope, setScope] = useState("region");
  const [seniority, setSeniority] = useState<string>();
  const [titles, setTitles] = useState(["Frontend Engineer", "Full Stack Developer", "Product Engineer"]);
  const [jd, setJd] = useState("");

  return (
    <TooltipProvider>
      <AppShell user={{ name: label, email: viewer?.email ?? "arif.rahman@example.com", image: null }}>
        <div className="mx-auto max-w-[1240px] px-4 pt-8 pb-16 md:px-8 lg:px-12">
          <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
            <div>
              <h1 className="text-2xl font-semibold text-ink">Style tile</h1>
              <p className="mt-1 measure text-graphite">
                Tokens, type and every component in their states.{" "}
                {viewer
                  ? "Your name is on the sample; everything else in it is fictional."
                  : "All content is fictional."}{" "}
                For review before real screens are built.
              </p>
            </div>
            <ThemeControl />
          </header>

          <nav aria-label="Style tile sections" className="mb-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {[
              ["desk", "Tailoring desk"],
              ["reading", "Long post"],
              ["today", "Today rows"],
              ["color", "Color"],
              ["type", "Type"],
              ["controls", "Controls"],
              ["overlays", "Overlays"],
              ["progress", "Progress"],
              ["tracker", "Tracker"],
              ["companies", "Companies"],
              ["states", "States"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-graphite underline decoration-rule hover:text-ink hover:decoration-ink"
              >
                {label}
              </a>
            ))}
          </nav>

          <Section
            id="desk"
            title="The tailoring desk"
            intro="The signature moment. A blue pen circles each matched word in reading order while the score counts up from the master CV score; red pen underlines land on the missing words at the end."
          >
            {/* The desk needs the full page width, like the real tailor page. */}
            <div className="lg:-mx-8">
              <ProofingDesk cv={cv} />
            </div>
          </Section>

          <Section
            id="reading"
            title="Reading a long job post"
            intro="The full post at its reading width, marked up. Running text in --body at 16 px, with a 28 px line height so pen marks never touch the next line, 72 characters a line."
          >
            <Panel className="px-5 pt-7 pb-6 md:px-10 md:pt-9 md:pb-8">
              <p className="text-lg font-semibold text-ink">{sampleJd.title}</p>
              <p className="mb-5 text-sm text-graphite">Lumen Labs, direct from careers page (Ashby)</p>
              <MarkedText
                text={sampleJd.text}
                marks={findSampleMarks(sampleJd.text, sampleJd.matched, sampleJd.missing)}
              />
            </Panel>
          </Section>

          <Section
            id="today"
            title="Today rows"
            intro="Rows on a white index card, separated by blue ruled lines, with the red rule across the top. Fit in tabular figures with a thin bar. Click a row to expand it."
          >
            <TodayPreview firstName={firstName} />
          </Section>

          <Section
            id="color"
            title="Color"
            intro="Both themes, side by side. Light is an index card on a desk; dark is carbon paper. The CV sheet stays white in both."
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
              <TokenPanel theme="light" />
              <TokenPanel theme="dark" />
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {(["light", "dark"] as const).map((t) => (
                <div key={t} data-theme={t} className="rounded-panel border border-rule bg-paper p-6">
                  <div className="max-w-[340px]">
                    <CvSheet doc={cv} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="type"
            title="Type"
            intro="IBM Plex Sans for the interface, Plex Mono only for LaTeX, Latin Modern Roman for the CV."
          >
            <dl className="divide-y divide-rule border-y border-rule">
              {[
                [
                  "text-2xl",
                  "31 / 38",
                  <span key="a" className="text-2xl font-semibold text-ink">
                    Good afternoon, {firstName}
                  </span>,
                ],
                [
                  "text-xl",
                  "25 / 32",
                  <span key="b" className="text-xl font-semibold text-ink">
                    Companies
                  </span>,
                ],
                [
                  "text-lg",
                  "20 / 28",
                  <span key="c" className="text-lg font-semibold text-ink">
                    Senior Frontend Engineer
                  </span>,
                ],
                [
                  "text-base",
                  "16 / 24",
                  <span key="d" className="block measure">
                    You will build product features in React and TypeScript, work closely with our design systems team,
                    and ship weekly.
                  </span>,
                ],
                [
                  "text-sm",
                  "14 / 20",
                  <span key="e" className="text-sm text-graphite">
                    Direct from careers page (Greenhouse)
                  </span>,
                ],
                [
                  "text-xs",
                  "12 / 16",
                  <span key="f" className="text-xs text-graphite">
                    Checked today at 6:32
                  </span>,
                ],
                [
                  "text-score",
                  "48 / 48",
                  <span key="g" className="text-score text-ink tabular">
                    74
                  </span>,
                ],
                [
                  "Plex Mono",
                  "13 / 20",
                  <code key="h" className="font-mono text-[13px]">
                    {String.raw`\resumeItem{Built the \textbf{real-time shipment dashboard}}`}
                  </code>,
                ],
                [
                  "CV serif",
                  "Latin Modern",
                  <span key="i" className="font-cv text-[17px] leading-6">
                    Built the <b>real-time shipment dashboard</b> used by <b>40 client teams</b>.{" "}
                    <i>Tech: React, TypeScript, Node.js</i>
                  </span>,
                ],
              ].map(([token, size, sample]) => (
                <div key={token as string} className="grid gap-x-6 gap-y-1 py-4 md:grid-cols-[160px_1fr]">
                  <dt className="text-sm">
                    <span className="block font-medium text-ink">{token}</span>
                    <span className="text-graphite tabular">{size}</span>
                  </dt>
                  <dd className="min-w-0 text-body">{sample}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-graphite">--ink: headings, titles, fit score, links</p>
                <p className="mt-2 text-lg font-semibold text-ink">Senior Frontend Engineer</p>
              </div>
              <div>
                <p className="text-sm text-graphite">--body: all running text</p>
                <p className="mt-2 text-base text-body">
                  You will work with our product designer and one backend engineer to split the booking flow into
                  smaller steps.
                </p>
              </div>
              <div>
                <p className="text-sm text-graphite">--graphite: secondary lines</p>
                <p className="mt-2 text-sm text-graphite">Lumen Labs, direct from careers page (Ashby). 2 days ago</p>
              </div>
            </div>
          </Section>

          <Section id="controls" title="Controls">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
              <Sub title="Buttons">
                <div className="flex flex-wrap items-center gap-2">
                  <Button>Tailor CV</Button>
                  <Button variant="secondary">Open job</Button>
                  <Button variant="ghost">Save</Button>
                  <Button variant="destructive">Delete all data</Button>
                  <Button variant="link">Copy LaTeX</Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm">Run now</Button>
                  <Button size="sm" variant="secondary">
                    <PlusIcon aria-hidden />
                    Add a company
                  </Button>
                  <Button disabled>Tailoring</Button>
                  <Button variant="secondary" disabled>
                    Re-tailor
                  </Button>
                </div>
              </Sub>

              <Sub title="Chips">
                <div className="flex flex-wrap gap-2">
                  <FilterChip pressed>Pay listed</FilterChip>
                  <FilterChip>Direct only</FilterChip>
                  <FilterChip menu>Seniority</FilterChip>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <KeywordChip kind="matched">TypeScript</KeywordChip>
                  <KeywordChip kind="missing" importance="must">
                    GraphQL
                  </KeywordChip>
                  <KeywordChip kind="missing">Storybook</KeywordChip>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Tag>New company</Tag>
                  <Tag tone="ok">Eligible</Tag>
                  <Tag tone="caution">Eligibility unclear</Tag>
                  <Tag tone="redpen">Staffing agency</Tag>
                  <Tag tone="new">New</Tag>
                  <Stamp>Applied</Stamp>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {titles.map((t) => (
                    <TokenChip key={t} onRemove={() => setTitles((x) => x.filter((y) => y !== t))}>
                      {t}
                    </TokenChip>
                  ))}
                </div>
              </Sub>

              <Sub title="Text fields">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="gh">GitHub username</Label>
                    <Input id="gh" defaultValue="example-arif" />
                    <FieldHint>12 public repos, 6 with READMEs</FieldHint>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="url">Portfolio URL</Label>
                    <Input id="url" placeholder="https://" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sal">Minimum annual salary in USD</Label>
                    <Input id="sal" defaultValue="about forty" aria-invalid aria-describedby="sal-err" />
                    <FieldError id="sal-err">Enter an amount like 40k, 40,000 or 40000.</FieldError>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dis">Email on the CV</Label>
                    <Input id="dis" disabled defaultValue="arif.rahman@example.com" />
                  </div>
                </div>
              </Sub>

              <Sub title="Paste area, select, combobox, segmented">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="jd" className="sr-only">
                      Job post
                    </Label>
                    <Textarea
                      id="jd"
                      value={jd}
                      onChange={(e) => setJd(e.target.value)}
                      placeholder="Paste the full job post. Messy text is fine."
                      className="min-h-36"
                    />
                    <FieldHint>
                      <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to tailor
                    </FieldHint>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="sen">Seniority</Label>
                      <Select
                        id="sen"
                        value={seniority}
                        onValueChange={setSeniority}
                        placeholder="Any level"
                        options={[
                          { value: "junior", label: "Junior" },
                          { value: "mid", label: "Mid" },
                          { value: "senior", label: "Senior" },
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-ink">Country</span>
                      <Combobox
                        aria-label="Country"
                        value={country}
                        onValueChange={setCountry}
                        searchPlaceholder="Search countries"
                        options={[
                          { value: "BD", label: "Bangladesh" },
                          { value: "IN", label: "India" },
                          { value: "PK", label: "Pakistan" },
                          { value: "NP", label: "Nepal" },
                          { value: "LK", label: "Sri Lanka" },
                          { value: "DE", label: "Germany" },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-sm font-medium text-ink">What kind of remote?</span>
                    <Segmented
                      aria-label="What kind of remote?"
                      value={scope}
                      onValueChange={setScope}
                      options={[
                        { value: "world", label: "Worldwide" },
                        { value: "region", label: "My region" },
                        { value: "onsite", label: "Also on-site in..." },
                      ]}
                    />
                  </div>
                </div>
              </Sub>
            </div>
          </Section>

          <Section
            id="overlays"
            title="Overlays"
            intro="Dialog, sheet, popover, tooltip, toast, the command palette and the account menu (it also sits at the bottom of the rail)."
          >
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Add a company</Button>
                </DialogTrigger>
                <DialogContent
                  title="Add a company"
                  description="Paste a careers page or company website."
                  footer={
                    <>
                      <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                      </DialogClose>
                      <Button>Track this company</Button>
                    </>
                  }
                >
                  <div className="space-y-3">
                    <Input defaultValue="https://jobs.ashbyhq.com/lumenlabs" aria-label="Careers or website URL" />
                    <p className="flex items-center gap-2 text-sm text-ink">
                      <span className="size-2 rounded-pill bg-ok" aria-hidden />
                      Found an Ashby board with 12 open roles.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Version history</Button>
                </SheetTrigger>
                <SheetContent title="Version history" description="Every save is kept. Restore any version.">
                  <ol className="divide-y divide-rule border-y border-rule">
                    {[
                      ["Version 4", "Today at 9:14", "Added GraphQL to Ledgerly"],
                      ["Version 3", "Yesterday at 21:02", "Resolved end date for Kite & Co. Digital"],
                      ["Version 2", "Oct 26 at 18:40", "Imported LinkedIn PDF"],
                    ].map(([v, when, what], i) => (
                      <li key={v} className="flex items-center justify-between gap-3 py-3">
                        <div className="text-sm">
                          <p className="font-medium text-ink">
                            {v} {i === 0 && <span className="font-normal text-graphite">(current)</span>}
                          </p>
                          <p className="text-graphite">
                            {when}. {what}
                          </p>
                        </div>
                        {i > 0 && (
                          <Button variant="secondary" size="sm">
                            Restore
                          </Button>
                        )}
                      </li>
                    ))}
                  </ol>
                </SheetContent>
              </Sheet>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">Where this appears</Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-sm">
                  <p className="font-medium text-ink">TypeScript appears in</p>
                  <ul className="mt-2 space-y-1 text-graphite">
                    <li>Summary</li>
                    <li>Technical skills, Languages</li>
                    <li>Brightfield Software, Tech line</li>
                  </ul>
                </PopoverContent>
              </Popover>

              <div className="w-56 rounded-panel border border-dashed border-rule p-1">
                <AccountMenu user={{ name: label, email: viewer?.email ?? "arif.rahman@example.com", image: null }} />
              </div>
              <Tooltip content="Real ATS systems differ. This is an estimate.">
                <Button variant="secondary">Hover for a tooltip</Button>
              </Tooltip>

              <Button
                variant="secondary"
                onClick={() => toast("Dismissed.", { action: { label: "Undo", onClick: () => toast("Restored.") } })}
              >
                Show a toast
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
              >
                Command palette <Kbd>Ctrl K</Kbd>
              </Button>
            </div>
          </Section>

          <Section id="progress" title="Progress">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
              <Sub title="Onboarding steps">
                <ProgressSteps
                  steps={["Add your CV", "More sources", "Review profile", "What you want", "First search"]}
                  current={2}
                />
              </Sub>
              <Sub title="Tailoring progress">
                <TaskSteps
                  steps={[
                    { label: "Reading the job", state: "done", detail: "14 keywords, 9 required" },
                    { label: "Tailoring your CV", state: "running" },
                    { label: "Checking every claim against your profile", state: "todo" },
                  ]}
                />
              </Sub>
            </div>
          </Section>

          <Section id="tracker" title="Tracker" intro="Drag cards between columns, or use Move to from the keyboard.">
            <KanbanBoard>
              <KanbanColumn name="Saved" count={2}>
                <KanbanCard
                  title="Product Engineer, Billing"
                  company="Paperplane Payroll"
                  moved="Saved 2 days ago"
                  column="Saved"
                />
                <KanbanCard title="Frontend Engineer" company="Fieldnote" moved="Saved today" column="Saved" dragging />
              </KanbanColumn>
              <KanbanColumn name="Applied" count={1} dropping>
                <KanbanCard
                  title="Senior Frontend Engineer"
                  company="Lumen Labs"
                  moved="Applied yesterday"
                  tailoredHref="#desk"
                  column="Applied"
                />
              </KanbanColumn>
              <KanbanColumn name="Interviewing" count={1}>
                <KanbanCard
                  title="Full Stack Developer (React, Node)"
                  company="Tallow Health"
                  moved="Moved Oct 24"
                  tailoredHref="#desk"
                  column="Interviewing"
                />
              </KanbanColumn>
              <KanbanColumn name="Offer" count={0}>
                <p className="px-1 text-sm text-graphite">Nothing here yet.</p>
              </KanbanColumn>
              <KanbanColumn name="Closed" count={0}>
                <p className="px-1 text-sm text-graphite">Nothing here yet.</p>
              </KanbanColumn>
            </KanbanBoard>
          </Section>

          <Section id="companies" title="Companies">
            <DataTable
              caption="Tracked companies"
              rows={sampleCompanies}
              rowKey={(r) => r.name}
              columns={[
                {
                  key: "name",
                  header: "Company",
                  cell: (r) => (
                    <span>
                      <span className="block font-medium">{r.name}</span>
                      <span className="text-graphite">{r.website}</span>
                    </span>
                  ),
                },
                { key: "ats", header: "Board", cell: (r) => r.ats },
                { key: "roles", header: "Open roles", align: "right", cell: (r) => r.roles },
                {
                  key: "checked",
                  header: "Last checked",
                  cell: (r) => <span className="text-graphite">{r.checked}</span>,
                },
                { key: "via", header: "Found through", cell: (r) => <span className="text-graphite">{r.via}</span> },
                {
                  key: "flags",
                  header: "Flags",
                  cell: (r) => (
                    <span className="flex flex-wrap gap-1">
                      {r.flags.map((f) => (
                        <Tag key={f} tone={f === "Staffing agency" ? "redpen" : f === "Paused" ? "caution" : "neutral"}>
                          {f}
                        </Tag>
                      ))}
                    </span>
                  ),
                },
              ]}
            />
          </Section>

          <Section
            id="states"
            title="States"
            intro="Loading, empty, error and partial states. Every screen gets all of them."
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
              <Sub title="Pipeline warning">
                <CautionBar
                  action={
                    <Button size="sm" variant="secondary">
                      Run search now
                    </Button>
                  }
                >
                  The last search ran 31 hours ago. It may be running late, or the daily search may have been paused.
                </CautionBar>
              </Sub>
              <Sub title="Error">
                <ErrorState title="Gemini's rate limit was reached." onRetry={() => {}} retryLabel="Try again now">
                  Your CV will finish tailoring in about a minute, or you can try again now.
                </ErrorState>
              </Sub>
              <Sub title="Empty">
                <EmptyState
                  title="No new matches today."
                  action={
                    <Button variant="secondary">
                      <PlusIcon aria-hidden />
                      Add a company
                    </Button>
                  }
                >
                  412 companies checked at 6:32. Add a company you like on the Companies page to watch it too.
                </EmptyState>
              </Sub>
              <Sub title="Calm note">
                <Callout>
                  On Gemini&apos;s free tier, Google can use what you send to improve its products. Use a paid key or
                  another provider if you would rather it did not.
                </Callout>
              </Sub>
              <Sub title="Loading: score panel" className="lg:col-span-2">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[300px_1fr]">
                  <div aria-busy className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-12 w-24" />
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-1 w-full" />
                      </div>
                    ))}
                  </div>
                  <div aria-busy className="rounded-sheet bg-cv-paper p-8 shadow-sheet">
                    <Skeleton className="mx-auto h-6 w-48 bg-cv-rule" />
                    <Skeleton className="mx-auto mt-2 h-3 w-80 max-w-full bg-cv-rule" />
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="mt-6 space-y-2">
                        <Skeleton className="h-4 w-40 bg-cv-rule" />
                        <Skeleton className="h-3 w-full bg-cv-rule" />
                        <Skeleton className="h-3 w-11/12 bg-cv-rule" />
                      </div>
                    ))}
                  </div>
                </div>
              </Sub>
            </div>
          </Section>
          <p className={cn("text-sm text-graphite")}>
            Everything on this page is fictional sample content. Not shown in production builds.
          </p>
        </div>
      </AppShell>
    </TooltipProvider>
  );
}
