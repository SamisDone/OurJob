"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleCheck, Clock, FileUser, FolderGit2, Globe, NotebookPen } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DropZone } from "@/components/forms/drop-zone";
import { LoadError } from "@/components/load-error";
import { Nums } from "@/components/nums";
import { PreferencesForm } from "@/components/profile/preferences-form";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { TaskSteps } from "@/components/task-steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  useBuildProfile,
  useConfirmProfile,
  useImportGitHub,
  useImportPortfolio,
  useProfile,
  useRemoveSource,
  useSaveTextSource,
  useSources,
  useUploadSource,
  type SourceSummary,
} from "@/lib/query/profile";
import { cn } from "@/lib/utils";

const STEPS = ["Add your CV", "More sources", "Review profile", "What you want", "First search"];
const CV_KINDS = ["cv_tex", "cv_pdf", "cv_docx", "cv_md"];

function useStep() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = Number(params.get("step") ?? "1");
  const step = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : 1;
  const go = (n: number) => {
    router.push(`${pathname}?step=${n}`);
    window.scrollTo({ top: 0 });
  };
  return { step, go, href: (n: number) => `${pathname}?step=${n}` };
}

/**
 * Onboarding progress: step names, the current one in the foreground color,
 * done ones with a check. Done steps link back to that step; future steps are
 * muted text. One line on phones.
 */
function ProgressSteps({ current, href }: { current: number; href: (step: number) => string }) {
  return (
    <nav aria-label="Onboarding progress" className="mb-8">
      <p className="text-sm text-muted-foreground md:hidden">
        <Nums>{`Step ${current + 1} of ${STEPS.length}`}</Nums>:{" "}
        <span className="font-medium text-foreground">{STEPS[current]}</span>
      </p>
      <ol className="hidden items-center text-sm md:flex">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          const marker = (
            <span
              className={cn(
                "num inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                state === "done" && "bg-primary text-primary-foreground",
                state === "current" && "border-2 border-foreground font-semibold",
                state === "todo" && "border text-muted-foreground",
              )}
              aria-hidden
            >
              {state === "done" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
          );
          return (
            <li key={label} className="flex min-w-0 items-center" aria-current={state === "current" ? "step" : undefined}>
              {i > 0 && <span className="mx-2 h-px w-4 shrink-0 bg-border" aria-hidden />}
              {state === "done" ? (
                <Link
                  href={href(i + 1)}
                  className="group inline-flex items-center gap-2 rounded-md py-1 whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {marker}
                  <span className="underline-offset-4 group-hover:underline">{label}</span>
                  <span className="sr-only"> (done, go back to this step)</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 py-1 whitespace-nowrap">
                  {marker}
                  <span className={state === "current" ? "font-medium" : "text-muted-foreground"}>{label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="max-w-prose text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Onboarding steps 1 to 4 (DESIGN.md 5.2). Step 5, the live first search, arrives with the job feed. */
export function OnboardingFlow() {
  const { step, go, href } = useStep();
  return (
    <>
      <ProgressSteps current={step - 1} href={href} />
      {/* Reading width for the form steps; the profile review keeps the full width. */}
      <div className={step === 3 ? undefined : "max-w-[640px]"}>
        {step === 1 && <CvStep next={() => go(2)} />}
        {step === 2 && <MoreSourcesStep back={() => go(1)} next={() => go(3)} />}
        {step === 3 && <ReviewStep back={() => go(2)} next={() => go(4)} />}
        {step === 4 && <PreferencesStep back={() => go(3)} next={() => go(5)} />}
        {step === 5 && <DoneStep back={() => go(4)} />}
      </div>
    </>
  );
}

/** One text box and a button: GitHub username, portfolio link, pasted text, notes. */
function TextForm({
  id,
  label,
  hideLabel,
  placeholder,
  submitLabel,
  pendingLabel,
  pending,
  multiline,
  schema = z.string().trim().min(1),
  onSubmit,
  error,
  children,
}: {
  id: string;
  label: string;
  hideLabel?: boolean;
  placeholder: string;
  submitLabel: string;
  pendingLabel?: string;
  pending: boolean;
  multiline?: boolean;
  schema?: z.ZodType<string, string>;
  onSubmit: (value: string) => void;
  error?: string;
  children?: ReactNode;
}) {
  const form = useForm<{ value: string }>({
    resolver: zodResolver(z.object({ value: schema })),
    defaultValues: { value: "" },
  });
  const value = useWatch({ control: form.control, name: "value" });
  return (
    <form noValidate onSubmit={(e) => void form.handleSubmit((v) => onSubmit(v.value.trim()))(e)}>
      <Controller
        name="value"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || error ? true : undefined}>
            <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
              {label}
            </FieldLabel>
            <div className={multiline ? "space-y-2" : "flex gap-2"}>
              {multiline ? (
                <Textarea {...field} id={id} placeholder={placeholder} className="min-h-24" />
              ) : (
                <Input {...field} id={id} placeholder={placeholder} aria-invalid={fieldState.invalid || undefined} />
              )}
              <Button type="submit" variant="outline" disabled={!value.trim() || pending}>
                {pending && <Spinner data-icon="inline-start" />}
                {pending && pendingLabel ? pendingLabel : submitLabel}
              </Button>
            </div>
            {children}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            {error && <FieldError>{error}</FieldError>}
          </Field>
        )}
      />
    </form>
  );
}

/* Step 1 ---------------------------------------------------------------------- */

const CV_TYPES = "LaTeX (.tex), PDF, Word (.docx) or Markdown, up to 5 MB.";

function CvStep({ next }: { next: () => void }) {
  const sources = useSources();
  const upload = useUploadSource();
  const pasteCv = useSaveTextSource();
  const cv = sources.data?.find((s) => CV_KINDS.includes(s.kind));
  const [replacing, setReplacing] = useState(false);
  const [pasting, setPasting] = useState(false);

  const done = () => {
    setReplacing(false);
    setPasting(false);
  };

  return (
    <>
      <StepTitle title="Add your CV" />
      {sources.isPending ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : cv && !replacing ? (
        <CvPreview source={cv} onReplace={() => setReplacing(true)} next={next} />
      ) : pasting ? (
        <Card>
          <CardContent className="space-y-4">
            <TextForm
              id="cv-text"
              label="Paste your CV"
              multiline
              placeholder="Everything from your name to your last line. Formatting does not matter."
              submitLabel="Use this text"
              pendingLabel="Saving"
              pending={pasteCv.isPending}
              error={pasteCv.isError ? pasteCv.error.message : undefined}
              onSubmit={(text) => pasteCv.mutate({ kind: "cv", text }, { onSuccess: done })}
            />
            <Button variant="ghost" onClick={() => setPasting(false)}>
              Upload a file instead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <DropZone
                accept=".tex,.pdf,.docx,.md,.markdown,.txt"
                busy={upload.isPending}
                label="Your CV file"
                hint={`${CV_TYPES} Only you can see it.`}
                onFile={(file) => upload.mutate({ file }, { onSuccess: done })}
              />
            </CardContent>
          </Card>
          <p className="mt-4 text-sm text-muted-foreground">
            Using Overleaf? Open Menu, then Download source, and upload the .tex file.
          </p>
          <Button variant="link" className="mt-1 px-0" onClick={() => setPasting(true)}>
            Paste your CV as text instead
          </Button>
        </>
      )}
      {upload.isError && (
        <LoadError className="mt-4" title="That file could not be used.">
          {upload.error.message}
        </LoadError>
      )}
    </>
  );
}

function CvPreview({ source, onReplace, next }: { source: SourceSummary; onReplace: () => void; next: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{source.filename ?? "Your CV"}</h2>
        </CardTitle>
        <CardDescription>
          <Nums>{`${source.chars.toLocaleString()} characters read`}</Nums>
          {source.meta.structured ? ", sections recognized" : ""}. Check that this is your CV and the text came through.
          Formatting does not matter here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="max-h-[420px] overflow-y-auto rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-6 whitespace-pre-wrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          tabIndex={0}
          aria-label="Text read from your CV"
        >
          {source.preview}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button onClick={next}>
          <Check data-icon="inline-start" />
          Looks right
        </Button>
        <Button variant="outline" onClick={onReplace}>
          Upload a different file
        </Button>
      </CardFooter>
    </Card>
  );
}

/* Step 2 ---------------------------------------------------------------------- */

function SourceRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-4 gap-y-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[32px_1fr]" aria-label={title}>
      <span
        className="hidden size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground md:flex [&_svg]:size-4"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="font-medium">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </section>
  );
}

function Added({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <CircleCheck className="size-4 text-success" aria-hidden />
      {children}
      <Button variant="link" size="sm" className="px-0" onClick={onRemove}>
        Remove
      </Button>
    </p>
  );
}

const githubUsername = z
  .string()
  .trim()
  .regex(/^[a-z\d](?:[a-z\d-]{0,38})$/i, "A GitHub username has letters, numbers and dashes only.");
const portfolioUrl = z
  .string()
  .trim()
  .refine((s) => /^(https?:\/\/)?[^\s.]+\.\S+$/i.test(s), "Enter your site's address, like https://example.com");

function MoreSourcesStep({ back, next }: { back: () => void; next: () => void }) {
  const sources = useSources();
  const upload = useUploadSource();
  const github = useImportGitHub();
  const portfolio = useImportPortfolio();
  const saveText = useSaveTextSource();
  const remove = useRemoveSource();
  const build = useBuildProfile();
  const find = (kind: string) => sources.data?.find((s) => s.kind === kind);
  const li = find("linkedin_pdf");
  const gh = find("github");
  const pf = find("portfolio");
  const nt = find("notes");

  return (
    <>
      <StepTitle title="Add more sources">
        Optional. Each one fills gaps your CV leaves. Anything that disagrees with your CV is shown to you, never picked
        silently.
      </StepTitle>
      <Card>
        <CardContent className="divide-y">
          <SourceRow icon={<FileUser />} title="LinkedIn profile">
            {li ? (
              <Added onRemove={() => remove.mutate("linkedin_pdf")}>
                <Nums>{`LinkedIn export added, ${li.chars.toLocaleString()} characters.`}</Nums>
              </Added>
            ) : (
              <Field>
                <FieldDescription>
                  On your LinkedIn profile, choose More, then Save to PDF. Upload that file here. The app never visits
                  linkedin.com.
                </FieldDescription>
                <Input
                  type="file"
                  accept=".pdf"
                  aria-label="LinkedIn PDF"
                  className="max-w-sm"
                  disabled={upload.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload.mutate({ file: f, linkedin: true });
                    e.target.value = "";
                  }}
                />
                {upload.isPending && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Reading the file
                  </p>
                )}
                {upload.isError && <FieldError>{upload.error.message}</FieldError>}
              </Field>
            )}
          </SourceRow>

          <SourceRow icon={<FolderGit2 />} title="GitHub">
            {gh ? (
              <Added onRemove={() => remove.mutate("github")}>
                <Nums>
                  {`${String(gh.meta.login ?? "GitHub")}: ${Number(gh.meta.publicRepos ?? 0)} public repos, ${Number(gh.meta.withReadme ?? 0)} with READMEs.`}
                </Nums>
              </Added>
            ) : (
              <TextForm
                id="github-username"
                label="GitHub username"
                hideLabel
                placeholder="Your GitHub username"
                submitLabel="Find"
                pendingLabel="Looking"
                pending={github.isPending}
                schema={githubUsername}
                error={github.isError ? github.error.message : undefined}
                onSubmit={(u) => github.mutate(u)}
              />
            )}
          </SourceRow>

          <SourceRow icon={<Globe />} title="Portfolio site">
            {pf ? (
              <Added onRemove={() => remove.mutate("portfolio")}>
                <Nums>
                  {`${pf.meta.pasted ? "Pasted portfolio text" : `Read ${String(pf.meta.url ?? "your site")}`}, ${pf.chars.toLocaleString()} characters.`}
                </Nums>
              </Added>
            ) : portfolio.data?.thin ? (
              <TextForm
                id="portfolio-text"
                label="Portfolio text"
                hideLabel
                multiline
                placeholder="About, projects, anything useful"
                submitLabel="Save text"
                pending={saveText.isPending}
                error={saveText.isError ? saveText.error.message : undefined}
                onSubmit={(text) => saveText.mutate({ kind: "portfolio", text, url: portfolio.data?.url })}
              >
                <FieldDescription>
                  {portfolio.data.url} has very little text in its HTML, so it probably builds the page in the browser.
                  Paste the text from your site instead.
                </FieldDescription>
              </TextForm>
            ) : (
              <TextForm
                id="portfolio-url"
                label="Portfolio URL"
                hideLabel
                placeholder="https://"
                submitLabel="Read"
                pendingLabel="Reading"
                pending={portfolio.isPending}
                schema={portfolioUrl}
                error={portfolio.isError ? portfolio.error.message : undefined}
                onSubmit={(u) => portfolio.mutate(u)}
              />
            )}
          </SourceRow>

          <SourceRow icon={<NotebookPen />} title="Things your CV leaves out">
            {nt ? (
              <Added onRemove={() => remove.mutate("notes")}>
                <Nums>{`Notes added, ${nt.chars.toLocaleString()} characters.`}</Nums>
              </Added>
            ) : (
              <TextForm
                id="notes"
                label="Things your CV leaves out"
                hideLabel
                multiline
                placeholder="A side project, a tool you use daily, a result you are proud of. Facts only."
                submitLabel="Save notes"
                pending={saveText.isPending}
                error={saveText.isError ? saveText.error.message : undefined}
                onSubmit={(text) => saveText.mutate({ kind: "notes", text })}
              />
            )}
          </SourceRow>
        </CardContent>
      </Card>

      <div className="mt-8">
        {build.isPending ? (
          <Card>
            <CardHeader>
              <CardTitle>Building your profile</CardTitle>
              <CardDescription>This takes up to a minute.</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskSteps steps={["Reading your sources", "Building your profile"]} current={1} />
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => build.mutate(undefined, { onSuccess: next })}>
              Build my profile
            </Button>
            <Button size="lg" variant="ghost" onClick={back}>
              Back
            </Button>
          </div>
        )}
        {build.isError && (
          <LoadError
            className="mt-4"
            title="Your profile was not built."
            onRetry={() => build.mutate(undefined, { onSuccess: next })}
          >
            {build.error.message}
          </LoadError>
        )}
      </div>
    </>
  );
}

/* Step 3 ---------------------------------------------------------------------- */

function ReviewStep({ back, next }: { back: () => void; next: () => void }) {
  const q = useProfile();
  const confirm = useConfirmProfile();
  const conflicts = q.data?.data.conflicts.length ?? 0;
  return (
    <>
      <StepTitle title="Review your profile">
        This is the only thing the app will ever say about you. Fix anything wrong, add anything missing. Nothing is
        used for tailoring until you confirm.
      </StepTitle>
      {q.isPending && <Skeleton className="h-96 w-full rounded-xl" />}
      {q.isError && (
        <LoadError title="Your profile did not load." onRetry={() => void q.refetch()}>
          {q.error.message}
        </LoadError>
      )}
      {q.data === null && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No profile yet.</EmptyTitle>
            <EmptyDescription>Build it from your sources first.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={back}>Back to sources</Button>
          </EmptyContent>
        </Empty>
      )}
      {q.data && <ProfileEditor version={q.data} />}
      {q.data && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            disabled={conflicts > 0 || confirm.isPending}
            onClick={() => confirm.mutate(undefined, { onSuccess: next })}
          >
            <Check data-icon="inline-start" />
            This is right
          </Button>
          <Button size="lg" variant="ghost" onClick={back}>
            Back
          </Button>
          {conflicts > 0 && (
            <p className="text-sm text-muted-foreground">Choose a value for each disagreement above first.</p>
          )}
          {confirm.isError && (
            <p role="alert" className="text-sm text-destructive">
              {confirm.error.message}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/* Step 4 ---------------------------------------------------------------------- */

function PreferencesStep({ back, next }: { back: () => void; next: () => void }) {
  return (
    <>
      <StepTitle title="Set what you are looking for">
        These decide which jobs reach your daily feed. You can change them in Settings.
      </StepTitle>
      <Card>
        <CardContent>
          <PreferencesForm onSaved={next} saveLabel="Save and continue" />
        </CardContent>
      </Card>
      <Button variant="ghost" className="mt-4" onClick={back}>
        Back
      </Button>
    </>
  );
}

/* Step 5 ---------------------------------------------------------------------- */

function DoneStep({ back }: { back: () => void }) {
  return (
    <>
      <StepTitle title="Your profile is ready" />
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>The daily job search is not switched on yet.</EmptyTitle>
          <EmptyDescription>
            Your first search runs here once job sources are added to this deployment. Your profile and preferences are
            saved.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/profile">Go to your profile</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Settings</Link>
            </Button>
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </>
  );
}
