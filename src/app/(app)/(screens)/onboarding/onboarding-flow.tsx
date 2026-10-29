"use client";

import {
  CheckIcon,
  GithubLogoIcon,
  LinkedinLogoIcon,
  GlobeSimpleIcon,
  NotePencilIcon,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PreferencesForm } from "@/components/profile/preferences-form";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Button } from "@/components/legacy/button";
import { EmptyState, ErrorState, Panel, Skeleton } from "@/components/legacy/feedback";
import { DropZone } from "@/components/legacy/form-bits";
import { FieldHint, Input, Label, Textarea } from "@/components/legacy/input";
import { ProgressSteps, TaskSteps } from "@/components/legacy/steps";
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
  return { step, go };
}

function StepTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-8 mb-6 lg:mt-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && <p className="mt-2 measure text-body">{children}</p>}
    </div>
  );
}

/** Onboarding steps 1 to 4 (DESIGN.md 5.2). Step 5, the live first search, arrives with the job feed. */
export function OnboardingFlow() {
  const { step, go } = useStep();
  return (
    <>
      <ProgressSteps steps={STEPS} current={step - 1} onSelect={(i) => go(i + 1)} />
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

/* Step 1 ---------------------------------------------------------------------- */

const CV_TYPES = "LaTeX (.tex), PDF, Word (.docx) or Markdown, up to 5 MB.";

function CvStep({ next }: { next: () => void }) {
  const sources = useSources();
  const upload = useUploadSource();
  const pasteCv = useSaveTextSource();
  const cv = sources.data?.find((s) => CV_KINDS.includes(s.kind));
  const [replacing, setReplacing] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");

  const done = () => {
    setReplacing(false);
    setPasting(false);
    setText("");
  };

  return (
    <>
      <StepTitle title="Add your CV" />
      {sources.isPending ? (
        <Skeleton className="h-56 w-full rounded-panel" />
      ) : cv && !replacing ? (
        <CvPreview source={cv} onReplace={() => setReplacing(true)} next={next} />
      ) : pasting ? (
        <Panel className="px-6 pt-6 pb-6 md:px-8">
          <Label htmlFor="cv-text" className="text-lg font-semibold text-ink">
            Paste your CV
          </Label>
          <Textarea
            id="cv-text"
            className="mt-3 min-h-64"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Everything from your name to your last line. Formatting does not matter."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={!text.trim() || pasteCv.isPending}
              onClick={() => pasteCv.mutate({ kind: "cv", text }, { onSuccess: done })}
            >
              {pasteCv.isPending ? "Saving" : "Use this text"}
            </Button>
            <Button variant="ghost" onClick={() => setPasting(false)}>
              Upload a file instead
            </Button>
          </div>
          {pasteCv.isError && (
            <p role="alert" className="mt-3 text-sm text-redpen">
              {pasteCv.error.message}
            </p>
          )}
        </Panel>
      ) : (
        <>
          <DropZone
            accept=".tex,.pdf,.docx,.md,.markdown,.txt"
            busy={upload.isPending}
            label="Your CV file"
            hint={`${CV_TYPES} Only you can see it.`}
            onFile={(file) => upload.mutate({ file }, { onSuccess: done })}
          />
          <p className="mt-4 text-sm text-graphite">
            Using Overleaf? Open Menu, then Download source, and upload the .tex file.
          </p>
          <Button variant="link" size="sm" className="mt-2 text-sm" onClick={() => setPasting(true)}>
            Paste your CV as text instead
          </Button>
        </>
      )}
      {upload.isError && (
        <ErrorState className="mt-4" title="That file could not be used.">
          {upload.error.message}
        </ErrorState>
      )}
    </>
  );
}

function CvPreview({ source, onReplace, next }: { source: SourceSummary; onReplace: () => void; next: () => void }) {
  return (
    <Panel className="px-5 pt-6 pb-5 md:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{source.filename ?? "Your CV"}</h2>
        <p className="text-sm text-graphite">
          {source.chars.toLocaleString()} characters read
          {source.meta.structured ? ", sections recognized" : ""}
        </p>
      </div>
      <p className="mt-1 text-sm text-body">
        Check that this is your CV and the text came through. Formatting does not matter here.
      </p>
      <div
        className="mt-4 max-h-[420px] overflow-y-auto rounded-control border border-rule bg-paper px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-body"
        tabIndex={0}
        aria-label="Text read from your CV"
      >
        {source.preview}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={next}>
          <CheckIcon aria-hidden />
          Looks right
        </Button>
        <Button variant="secondary" onClick={onReplace}>
          Upload a different file
        </Button>
      </div>
    </Panel>
  );
}

/* Step 2 ---------------------------------------------------------------------- */

function SourceRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-5 gap-y-3 py-6 md:grid-cols-[28px_1fr]" aria-label={title}>
      <span className="hidden pt-0.5 text-graphite md:block" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </section>
  );
}

function Added({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
      <CheckIcon size={16} aria-hidden className="text-ok" />
      {children}
      <Button variant="link" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </p>
  );
}

function MoreSourcesStep({ back, next }: { back: () => void; next: () => void }) {
  const sources = useSources();
  const upload = useUploadSource();
  const github = useImportGitHub();
  const portfolio = useImportPortfolio();
  const saveText = useSaveTextSource();
  const remove = useRemoveSource();
  const build = useBuildProfile();
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [notes, setNotes] = useState("");
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
      <Panel className="px-5 md:px-8">
        <div className="divide-y divide-rule">
          <SourceRow icon={<LinkedinLogoIcon size={20} />} title="LinkedIn profile">
            {li ? (
              <Added onRemove={() => remove.mutate("linkedin_pdf")}>
                LinkedIn export added, {li.chars.toLocaleString()} characters.
              </Added>
            ) : (
              <>
                <p className="measure text-sm text-body">
                  On your LinkedIn profile, choose More, then Save to PDF. Upload that file here. The app never visits
                  linkedin.com.
                </p>
                <div className="mt-3">
                  <label className="inline-flex">
                    <span className="sr-only">LinkedIn PDF</span>
                    <input
                      type="file"
                      accept=".pdf"
                      aria-label="LinkedIn PDF"
                      className="text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-control file:border file:border-rule file:bg-sheet file:px-4 file:text-sm file:font-medium file:text-body hover:file:border-graphite"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload.mutate({ file: f, linkedin: true });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {upload.isPending && <FieldHint className="mt-2">Reading the file</FieldHint>}
                {upload.isError && (
                  <p role="alert" className="mt-2 text-sm text-redpen">
                    {upload.error.message}
                  </p>
                )}
              </>
            )}
          </SourceRow>

          <SourceRow icon={<GithubLogoIcon size={20} />} title="GitHub">
            {gh ? (
              <Added onRemove={() => remove.mutate("github")}>
                {String(gh.meta.login ?? "GitHub")}: {Number(gh.meta.publicRepos ?? 0)} public repos,{" "}
                {Number(gh.meta.withReadme ?? 0)} with READMEs.
              </Added>
            ) : (
              <form
                className="flex max-w-md gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (username.trim()) github.mutate(username.trim());
                }}
              >
                <Input
                  aria-label="GitHub username"
                  placeholder="Your GitHub username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Button type="submit" variant="secondary" disabled={!username.trim() || github.isPending}>
                  {github.isPending ? "Looking" : "Find"}
                </Button>
              </form>
            )}
            {github.isError && (
              <p role="alert" className="mt-2 text-sm text-redpen">
                {github.error.message}
              </p>
            )}
          </SourceRow>

          <SourceRow icon={<GlobeSimpleIcon size={20} />} title="Portfolio site">
            {pf ? (
              <Added onRemove={() => remove.mutate("portfolio")}>
                {pf.meta.pasted ? "Pasted portfolio text" : `Read ${String(pf.meta.url ?? "your site")}`},{" "}
                {pf.chars.toLocaleString()} characters.
              </Added>
            ) : portfolio.data?.thin ? (
              <div className="space-y-2">
                <p className="measure text-sm text-body">
                  {portfolio.data.url} has very little text in its HTML, so it probably builds the page in the browser.
                  Paste the text from your site instead.
                </p>
                <Textarea
                  aria-label="Portfolio text"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="About, projects, anything useful"
                />
                <Button
                  variant="secondary"
                  disabled={!pasted.trim() || saveText.isPending}
                  onClick={() => saveText.mutate({ kind: "portfolio", text: pasted, url: portfolio.data?.url })}
                >
                  Save text
                </Button>
              </div>
            ) : (
              <form
                className="flex max-w-xl gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (url.trim()) portfolio.mutate(url.trim());
                }}
              >
                <Input
                  aria-label="Portfolio URL"
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button type="submit" variant="secondary" disabled={!url.trim() || portfolio.isPending}>
                  {portfolio.isPending ? "Reading" : "Read"}
                </Button>
              </form>
            )}
            {portfolio.isError && (
              <p role="alert" className="mt-2 text-sm text-redpen">
                {portfolio.error.message}
              </p>
            )}
          </SourceRow>

          <SourceRow icon={<NotePencilIcon size={20} />} title="Things your CV leaves out">
            {nt ? (
              <Added onRemove={() => remove.mutate("notes")}>
                Notes added, {nt.chars.toLocaleString()} characters.
              </Added>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="notes" className="sr-only">
                  Things your CV leaves out
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="A side project, a tool you use daily, a result you are proud of. Facts only."
                />
                <Button
                  variant="secondary"
                  disabled={!notes.trim() || saveText.isPending}
                  onClick={() => saveText.mutate({ kind: "notes", text: notes })}
                >
                  Save notes
                </Button>
              </div>
            )}
          </SourceRow>
        </div>
      </Panel>

      <div className="mt-8">
        {build.isPending ? (
          <TaskSteps
            steps={[
              { label: "Reading your sources", state: "done" },
              { label: "Building your profile", state: "running", detail: "This takes up to a minute." },
            ]}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => build.mutate(undefined, { onSuccess: next })}>Build my profile</Button>
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
          </div>
        )}
        {build.isError && (
          <ErrorState
            className="mt-4"
            title="Your profile was not built."
            onRetry={() => build.mutate(undefined, { onSuccess: next })}
          >
            {build.error.message}
          </ErrorState>
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
      {q.isPending && <Skeleton className="h-96 w-full rounded-panel" />}
      {q.isError && (
        <ErrorState title="Your profile did not load." onRetry={() => void q.refetch()}>
          {q.error.message}
        </ErrorState>
      )}
      {q.data === null && (
        <EmptyState title="No profile yet." action={<Button onClick={back}>Back to sources</Button>}>
          Build it from your sources first.
        </EmptyState>
      )}
      {q.data && <ProfileEditor version={q.data} />}
      {q.data && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            disabled={conflicts > 0 || confirm.isPending}
            onClick={() => confirm.mutate(undefined, { onSuccess: next })}
          >
            <CheckIcon aria-hidden />
            This is right
          </Button>
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
          {conflicts > 0 && <FieldHint>Choose a value for each disagreement above first.</FieldHint>}
          {confirm.isError && (
            <p role="alert" className="text-sm text-redpen">
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
      <Panel className="px-5 pt-7 pb-7 md:px-8">
        <PreferencesForm onSaved={next} saveLabel="Save and continue" />
      </Panel>
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
      <EmptyState
        title="The daily job search is not switched on yet."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/profile">Go to your profile</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/settings">Settings</Link>
            </Button>
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
          </div>
        }
      >
        Your first search runs here once job sources are added to this deployment. Your profile and preferences are
        saved.
      </EmptyState>
    </>
  );
}
