"use client";

import { ChevronDown, CircleAlert, Copy, Download, ExternalLink, FilePlus2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CvPreview } from "@/components/cv/cv-preview";
import { Page, PageHeader } from "@/components/shell/page-states";
import { TaskSteps } from "@/components/task-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  /** Left out or removed for accuracy, with why. */
  removed?: { where: string; text: string; reason: string }[];
};

/** Before tailoring: one text area for the job post and one button. */
export function TailorPaste({
  onSubmit,
  initial = "",
  error,
  below,
}: {
  onSubmit: (text: string) => void;
  initial?: string;
  /** Why the last attempt failed, in words to show as they are. */
  error?: string | null;
  /** Shown under the card: his recent tailorings. */
  below?: ReactNode;
}) {
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
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" role="alert">
              <CircleAlert />
              <AlertTitle>The CV was not tailored.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
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
      {below}
    </Page>
  );
}

/** The pipeline stages (onStage: reading, tailoring, checking), in his words. */
const steps = ["Reading the job", "Tailoring your CV", "Checking every fact against your profile"] as const;

/** While tailoring: the three named steps, and the result layout in skeletons. */
export function TailorWorking({ step }: { step: 0 | 1 | 2 }) {
  return (
    <Page wide>
      <PageHeader title="Tailor" description={DESCRIPTION} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="aspect-[8.5/11] w-full max-w-[816px]" />
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tailoring your CV</CardTitle>
            <CardDescription>
              Usually under a minute. When Gemini is slow, a second model is asked as well and the first answer is used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaskSteps steps={steps} current={step} />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

/** After tailoring: the CV in tabs, the score, and the marked-up job post. */
/** Opens the LaTeX as a new Overleaf project: a form POST to /docs with encoded_snip (overleaf.com/devs, checked 2026-10-30). */
function useOverleaf(latex: string) {
  const form = useRef<HTMLFormElement>(null);
  const node = (
    <form ref={form} action="https://www.overleaf.com/docs" method="post" target="_blank" hidden>
      <input type="hidden" name="encoded_snip" value={encodeURIComponent(latex)} />
      <input type="hidden" name="engine" value="pdflatex" />
    </form>
  );
  const open = () => {
    form.current?.submit();
    toast("Opened in Overleaf in a new tab.");
  };
  return { node, open };
}

function download(latex: string, name: string) {
  const url = URL.createObjectURL(new Blob([latex], { type: "application/x-tex" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Downloaded ${name}.`);
}

export function TailorResultView({
  result,
  onNewPost,
  newPostHref,
  fileName = "resume.tex",
}: {
  result: TailorResult;
  onNewPost?: () => void;
  newPostHref?: string;
  fileName?: string;
}) {
  const r = result;
  const overleaf = useOverleaf(r.latex);
  const newPost = (children: ReactNode, props: { variant: "ghost"; size?: "sm" }) =>
    newPostHref ? (
      <Button asChild {...props}>
        <Link href={newPostHref}>{children}</Link>
      </Button>
    ) : (
      <Button {...props} onClick={onNewPost}>
        {children}
      </Button>
    );
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
            {newPost(
              <>
                <FilePlus2 data-icon="inline-start" />
                New job post
              </>,
              { variant: "ghost" },
            )}
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
                <DropdownMenuItem onSelect={() => download(r.latex, fileName)}>
                  <Download />
                  Download .tex
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {overleaf.node}
            <Button onClick={overleaf.open}>
              <ExternalLink data-icon="inline-start" />
              Open in Overleaf
            </Button>
          </>
        }
      />

      {/* Phones: score, CV, job post. Wide screens: CV on the left, score and job post on the right. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-rows-[auto_1fr]">
        <div className="xl:col-start-2 xl:row-start-1">
          <div className="space-y-6">
            <ScoreCard score={r.score} master={r.master} parts={r.parts} matched={r.matched} missing={r.missing} />
            {r.removed && r.removed.length > 0 && (
              <Alert variant="warning">
                <CircleAlert />
                <AlertTitle>Left out of this CV</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 space-y-2">
                    {r.removed.map((x, i) => (
                      <li key={i}>
                        <span className="font-medium">{x.where}:</span> {x.text}{" "}
                        <span className="text-muted-foreground">({x.reason})</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
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
                {newPost(
                  <>
                    <Pencil data-icon="inline-start" />
                    New post
                  </>,
                  { variant: "ghost", size: "sm" },
                )}
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
