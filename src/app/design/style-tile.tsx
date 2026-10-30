"use client";

import { ChevronDown, Copy, Download, ExternalLink, Info, Plus, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CvPreview } from "@/components/cv/cv-preview";
import { Combobox } from "@/components/forms/combobox";
import { DropZone } from "@/components/forms/drop-zone";
import { SourceBadges } from "@/components/forms/source-badges";
import { TokenInput } from "@/components/forms/token-input";
import { MatchBadge } from "@/components/jobs/match-badge";
import { LoadError } from "@/components/load-error";
import { Nums } from "@/components/nums";
import { ThemeControl } from "@/components/shell/theme-control";
import { LogoMark } from "@/components/shell/wordmark";
import { ScoreCard } from "@/components/tailor/score-card";
import { TaskSteps } from "@/components/task-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CvDocument } from "@/lib/cv/document";
import { sampleAts, sampleCv, sampleJd } from "@/lib/design/sample";

export type Viewer = { name: string; email: string } | null;

/** Puts the signed-in person's name on the sample. Nothing about them is stored or committed. */
function personalize(viewer: Viewer): { cv: CvDocument; label: string } {
  if (!viewer) return { cv: sampleCv, label: "Nadia Chowdhury (sample)" };
  const contact = sampleCv.contact.map((c) =>
    c.url?.startsWith("mailto:") ? { text: viewer.email, url: `mailto:${viewer.email}` } : c,
  );
  return { cv: { ...sampleCv, name: viewer.name, contact }, label: viewer.name };
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 border-t py-10">
      <div className="mb-6 space-y-1">
        <h2 id={`${id}-h`} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {intro && <p className="max-w-prose text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function Sub({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

const THEME_SWATCHES = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["primary", "bg-primary"],
  ["secondary", "bg-secondary"],
  ["border", "bg-border"],
] as const;

const STATUS = [
  { name: "success", text: "text-success", soft: "bg-success-soft", use: "Matched keywords, saved, up." },
  { name: "warning", text: "text-warning", soft: "bg-warning-soft", use: "A late search, unclear location." },
  { name: "destructive", text: "text-destructive", soft: "bg-destructive-soft", use: "Missing keywords, errors." },
  { name: "info", text: "text-info", soft: "bg-info-soft", use: "Focus, notes, added by you." },
] as const;

const COUNTRIES = [
  { value: "BD", label: "Bangladesh" },
  { value: "IN", label: "India" },
  { value: "PK", label: "Pakistan" },
  { value: "LK", label: "Sri Lanka" },
];

/** The style tile (DESIGN.md 10.3): theme, status colors, type, every component in use, and the states. */
export function StyleTile({ viewer }: { viewer: Viewer }) {
  const { cv, label } = personalize(viewer);
  const [titles, setTitles] = useState(["Backend Engineer", "Platform Engineer"]);
  const [country, setCountry] = useState<string>("BD");
  const [remote, setRemote] = useState("world");
  const [seniority, setSeniority] = useState(["mid", "senior"]);
  const [showUnlisted, setShowUnlisted] = useState(true);

  return (
    <main className="mx-auto w-full max-w-6xl bg-background px-6 pt-8 pb-24 md:px-8 lg:px-10">
      <header className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <LogoMark className="size-7" />
          <h1 className="text-2xl font-semibold tracking-tight">Style tile</h1>
          <p className="max-w-prose text-muted-foreground">
            Standard shadcn/ui (nova, neutral) with four status colors. Sample person: {label}. Screens with fictional
            data: <Link className="underline underline-offset-4" href="/preview/today">Today</Link> and{" "}
            <Link className="underline underline-offset-4" href="/preview/tailor">Tailor</Link>.
          </p>
        </div>
        <ThemeControl />
      </header>

      <Section id="color" title="Color" intro="Neutral everywhere. Color only carries meaning, never decoration.">
        <div className="grid gap-8 lg:grid-cols-2">
          <Sub title="Theme">
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {THEME_SWATCHES.map(([name, cls]) => (
                <li key={name} className="space-y-1.5">
                  <div className={`h-12 rounded-lg border ${cls}`} />
                  <p className="text-xs text-muted-foreground">{name}</p>
                </li>
              ))}
            </ul>
          </Sub>
          <Sub title="Status">
            <ul className="grid gap-2 sm:grid-cols-2">
              {STATUS.map((s) => (
                <li key={s.name} className={`rounded-lg px-3 py-2 ${s.soft}`}>
                  <p className={`text-sm font-medium ${s.text}`}>{s.name}</p>
                  <p className="text-xs text-foreground">{s.use}</p>
                </li>
              ))}
            </ul>
          </Sub>
        </div>
      </Section>

      <Section id="type" title="Type" intro="Geist Sans for words, Geist Mono for numbers only.">
        <div className="space-y-3">
          <p className="text-2xl font-semibold tracking-tight">Page title, 24 px semibold</p>
          <p className="text-xl font-semibold tracking-tight">Section title, 20 px semibold</p>
          <p className="font-medium">Card title, 16 px medium</p>
          <p>Body text, 16 px. Short sentences, plain verbs, sentence case.</p>
          <p className="text-sm text-muted-foreground">Secondary text, 14 px muted. Company, source and date lines.</p>
          <p className="text-sm">
            Numbers: <Nums>{"$95k to $130k a year, posted 2 days ago, 74 out of 100"}</Nums>
          </p>
        </div>
      </Section>

      <Section id="controls" title="Controls" intro="One primary button per view. Everything else is outline, ghost or in a menu.">
        <div className="grid gap-10 lg:grid-cols-2">
          <Sub title="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Tailor my CV</Button>
              <Button variant="outline">
                <Copy data-icon="inline-start" />
                Copy LaTeX
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Delete</Button>
              <Button variant="link">Link</Button>
              <Button variant="outline" size="icon" aria-label="Download">
                <Download />
              </Button>
              <Button disabled>Saving</Button>
            </div>
          </Sub>

          <Sub title="Badges">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Go</Badge>
              <Badge variant="destructive">Terraform</Badge>
              <Badge variant="warning">Location unclear</Badge>
              <Badge variant="info">New company</Badge>
              <MatchBadge fit={86} />
              <MatchBadge fit={null} />
              <SourceBadges sources={["cv", "linkedin", "user_added"]} />
            </div>
          </Sub>

          <Sub title="Fields">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="tile-name">Name on your CV</FieldLabel>
                <Input id="tile-name" defaultValue={cv.name} />
                <FieldDescription>Shown at the top of every tailored CV.</FieldDescription>
              </Field>
              <Field data-invalid>
                <FieldLabel htmlFor="tile-pay">Minimum pay, in US dollars a year</FieldLabel>
                <Input id="tile-pay" defaultValue="forty" aria-invalid />
                <FieldError>Enter an amount like 40k, 40,000 or 40000.</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="tile-search">Search</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput id="tile-search" placeholder="Title, company or skill" />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="tile-jd">Job post</FieldLabel>
                <Textarea id="tile-jd" className="min-h-24" defaultValue={sampleJd.text.slice(0, 180)} />
              </Field>
            </FieldGroup>
          </Sub>

          <Sub title="Choices">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="tile-titles">Job titles to search for</FieldLabel>
                <TokenInput id="tile-titles" label="Job titles" values={titles} onChange={setTitles} placeholder="Frontend Engineer" />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="tile-country">Where you work from</FieldLabel>
                  <Combobox
                    id="tile-country"
                    value={country}
                    onValueChange={setCountry}
                    options={COUNTRIES}
                    searchPlaceholder="Search countries"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="tile-diff">Largest time difference</FieldLabel>
                  <Select defaultValue="4">
                    <SelectTrigger id="tile-diff" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="4">Up to 4 hours</SelectItem>
                      <SelectItem value="8">Up to 8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldTitle id="tile-remote">What kind of remote?</FieldTitle>
                <RadioGroup
                  aria-labelledby="tile-remote"
                  value={remote}
                  onValueChange={setRemote}
                  className="flex flex-wrap gap-x-6 gap-y-3"
                >
                  {[
                    ["world", "Worldwide"],
                    ["region", "My region"],
                    ["onsite", "Also on-site in..."],
                  ].map(([value, text]) => (
                    <Field key={value} orientation="horizontal" className="w-auto">
                      <RadioGroupItem value={value} id={`tile-remote-${value}`} />
                      <FieldLabel htmlFor={`tile-remote-${value}`} className="font-normal max-md:min-h-11">
                        {text}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
              </Field>
              <Field>
                <FieldTitle id="tile-seniority">Seniority</FieldTitle>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  aria-labelledby="tile-seniority"
                  value={seniority}
                  onValueChange={setSeniority}
                  className="flex-wrap"
                >
                  {["intern", "junior", "mid", "senior"].map((s) => (
                    <ToggleGroupItem key={s} value={s} className="capitalize max-md:h-11">
                      {s}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="tile-unlisted">Show jobs that do not list pay</FieldLabel>
                  <FieldDescription>Unknown pay is shown as unknown, never guessed.</FieldDescription>
                </FieldContent>
                <Switch id="tile-unlisted" checked={showUnlisted} onCheckedChange={setShowUnlisted} />
              </Field>
            </FieldGroup>
          </Sub>

          <Sub title="Upload" className="lg:col-span-2">
            <DropZone
              accept=".pdf,.docx,.md,.tex"
              label="Sample file"
              hint="LaTeX (.tex), PDF, Word (.docx) or Markdown, up to 5 MB. Only you can see it."
              onFile={(f) => toast(`Would upload ${f.name}.`)}
            />
          </Sub>
        </div>
      </Section>

      <Section id="overlays" title="Overlays and menus" intro="Details open on demand instead of crowding the page.">
        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus data-icon="inline-start" />
                Add a company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a company</DialogTitle>
                <DialogDescription>Paste its careers page. The app finds its job board.</DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="tile-careers">Careers page</FieldLabel>
                <Input id="tile-careers" placeholder="https://" />
              </Field>
              <DialogFooter>
                <Button>Add company</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open a sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Senior Backend Engineer</SheetTitle>
                <SheetDescription>Lumen Labs, from their Greenhouse board.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                More
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Download />
                Download .tex
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink />
                Open in Overleaf
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete all data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your profile, tailored CVs and saved jobs are removed for good. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my data</AlertDialogCancel>
                <AlertDialogAction>Delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="About the score">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent>An estimate, not a real screener result.</TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={() => toast("Saved your preferences.")}>
            Show a toast
          </Button>
          <span className="text-sm text-muted-foreground">
            Search <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
          </span>
        </div>
      </Section>

      <Section id="progress" title="Progress" intro="Named steps while something runs. Never a spinner on its own.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tailoring your CV</CardTitle>
              <CardDescription>Usually under a minute.</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskSteps steps={["Reading the job", "Tailoring your CV", "Checking every fact against your profile"]} current={1} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Score parts</CardTitle>
              <CardDescription>Progress bars for each part of the estimate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sampleAts.components.slice(0, 3).map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <Nums>{`${c.points} of ${c.max}`}</Nums>
                  </div>
                  <Progress value={(c.points / c.max) * 100} aria-label={c.label} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="cv" title="CV and score" intro="The preview matches the PDF: Latin Modern, US Letter, never below 9 px.">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="latex">LaTeX</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="pt-2">
              <CvPreview doc={cv} />
            </TabsContent>
            <TabsContent value="latex" className="pt-2">
              <p className="text-sm text-muted-foreground">The LaTeX tab shows the rendered source in Tailor.</p>
            </TabsContent>
          </Tabs>
          <ScoreCard
            score={sampleAts.tailored}
            master={sampleAts.master}
            parts={sampleAts.components}
            matched={sampleJd.matched}
            missing={sampleJd.missing}
          />
        </div>
      </Section>

      <Section id="states" title="States" intro="Every screen has a designed loading, empty and error state.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Sub title="Warning">
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>The daily search is late.</AlertTitle>
              <AlertDescription>It last finished 2 days ago. Jobs below may be missing new posts.</AlertDescription>
            </Alert>
          </Sub>
          <Sub title="Error">
            <LoadError title="The job feed did not load." onRetry={() => toast("Trying again.")}>
              The database did not answer in time. Your jobs are safe; try again in a moment.
            </LoadError>
          </Sub>
          <Sub title="Calm note">
            <Alert>
              <Info />
              <AlertDescription>
                On Gemini&apos;s free tier, Google can use what you send to improve its products.
              </AlertDescription>
            </Alert>
          </Sub>
          <Sub title="Loading">
            <div aria-busy className="space-y-2 rounded-xl border p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </Sub>
          <Sub title="Empty" className="lg:col-span-2">
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>No new matches today.</EmptyTitle>
                <EmptyDescription>The search checked 412 companies. Widen your titles or time zones to see more.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline">Edit preferences</Button>
              </EmptyContent>
            </Empty>
          </Sub>
          <Sub title="Card with actions" className="lg:col-span-2">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Recent</CardTitle>
                <CardDescription>CVs you tailored before.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                Senior Backend Engineer <span className="text-muted-foreground">at Lumen Labs</span>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Open</Button>
                <Button size="sm" variant="ghost">
                  Remove
                </Button>
              </CardFooter>
            </Card>
          </Sub>
        </div>
      </Section>
    </main>
  );
}
