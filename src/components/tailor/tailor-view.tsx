"use client";

import { Check, ChevronDown, Copy, Download, ExternalLink, FilePlus2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CvPreview } from "@/components/cv/cv-preview";
import { Page, PageHeader } from "@/components/shell/page-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CvDocument } from "@/lib/cv/document";
import { ChangesList, type CvChange } from "./changes-list";
import { LatexView } from "./latex-view";
import { MarkedPost, type Mark } from "./marked-post";
import { ScoreCard, type ScorePart } from "./score-card";

const DESCRIPTION = "Paste a job post and get your CV rewritten for it, ready to open in Overleaf.";

export type TailorResult = {
  job: { title: string; company: string; text: string };
  marks: Mark[];
  cv: CvDocument;
  latex: string;
  changes: CvChange[];
  score: number;
  master: number;
  parts: ScorePart[];
  matched: string[];
  missing: string[];
};

/** Before tailoring: one text area for the job post and one button. */
export function TailorPaste({ onSubmit, initial = "" }: { onSubmit: (text: string) => void; initial?: string }) {
  const [text, setText] = useState(initial);
  const ready = text.trim().length > 0;
  return (
    <Page>
      <PageHeader title="Tailor" description={DESCRIPTION} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>
            <label htmlFor="job-post">Job post</label>
          </CardTitle>
          <CardDescription>Paste the full job post. Messy text from a select-all is fine.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="job-post"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && ready) onSubmit(text);
            }}
            placeholder="Senior Backend Engineer at Lumen Labs..."
            className="min-h-80 text-base md:text-base"
          />
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to tailor
          </p>
          <Button size="lg" disabled={!ready} onClick={() => onSubmit(text)}>
            Tailor my CV
          </Button>
        </CardFooter>
      </Card>
    </Page>
  );
}

const steps = ["Reading the job", "Tailoring your CV"] as const;

/** While tailoring: the two named steps, and the result layout in skeletons. */
export function TailorWorking({ step }: { step: 0 | 1 }) {
  return (
    <Page wide>
      <PageHeader title="Tailor" description={DESCRIPTION} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="aspect-[8.5/11] w-full max-w-[816px]" />
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tailoring your CV</CardTitle>
            <CardDescription>This usually takes 15 to 40 seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3" aria-live="polite">
              {steps.map((label, i) => (
                <li key={label} className="flex items-center gap-3">
                  {i < step ? (
                    <Check className="size-4 text-success" aria-hidden />
                  ) : i === step ? (
                    <Spinner className="size-4" />
                  ) : (
                    <span className="size-4 rounded-full border" aria-hidden />
                  )}
                  <span className={i > step ? "text-muted-foreground" : undefined}>
                    {label}
                    {i < step && <span className="sr-only">, done</span>}
                    {i === step && <span className="sr-only">, in progress</span>}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

/** After tailoring: the CV in tabs, the score, and the marked-up job post. */
export function TailorResultView({ result, onNewPost }: { result: TailorResult; onNewPost?: () => void }) {
  const r = result;
  return (
    <Page wide>
      <PageHeader
        title="Tailor"
        description={
          <>
            Your CV for <span className="font-medium text-foreground">{r.job.title}</span> at{" "}
            <span className="font-medium text-foreground">{r.job.company}</span>, ready to open in Overleaf.
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={onNewPost}>
              <FilePlus2 data-icon="inline-start" />
              New job post
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Export
                  <ChevronDown data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={async () => {
                    await navigator.clipboard.writeText(r.latex);
                    toast("Copied the LaTeX.");
                  }}
                >
                  <Copy />
                  Copy LaTeX
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast("Downloaded resume.tex.")}>
                  <Download />
                  Download .tex
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => toast("Opened in Overleaf in a new tab.")}>
              <ExternalLink data-icon="inline-start" />
              Open in Overleaf
            </Button>
          </>
        }
      />

      {/* Phones: score, CV, job post. Wide screens: CV on the left, score and job post on the right. */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-rows-[auto_1fr]">
        <div className="xl:col-start-2 xl:row-start-1">
          <ScoreCard score={r.score} master={r.master} parts={r.parts} matched={r.matched} missing={r.missing} />
        </div>
        <Tabs defaultValue="preview" className="min-w-0 gap-4 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="latex">LaTeX</TabsTrigger>
            <TabsTrigger value="changes">
              Changes <span className="num text-muted-foreground">{r.changes.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview">
            <CvPreview doc={r.cv} />
          </TabsContent>
          <TabsContent value="latex">
            <LatexView code={r.latex} />
          </TabsContent>
          <TabsContent value="changes">
            <ChangesList changes={r.changes} />
          </TabsContent>
        </Tabs>
        <div className="xl:col-start-2 xl:row-start-2">
          <Card>
            <CardHeader>
              <CardTitle>Job post</CardTitle>
              <CardDescription>
                <span className="mark-matched">Matched</span> and <span className="mark-missing">missing</span> words
                are highlighted.
              </CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" onClick={onNewPost}>
                  <Pencil data-icon="inline-start" />
                  Edit
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 pr-3">
                <MarkedPost text={r.job.text} marks={r.marks} />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
