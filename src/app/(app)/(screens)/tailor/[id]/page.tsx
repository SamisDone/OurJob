import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NeedsProfile } from "@/components/shell/page-states";
import { TailorResultView, type TailorResult } from "@/components/tailor/tailor-view";
import { requireUser } from "@/lib/auth/session";
import { buildCvDocument } from "@/lib/cv/build";
import { currentProfileStatus } from "@/lib/profile/status";
import { cvChanges, jobMarks } from "@/lib/tailor/report";
import { getProfileVersion, getTailoring } from "@/lib/tailor/service";

export const metadata: Metadata = { title: "Tailored CV" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile
        title="Tailored CV"
        description="Your CV tailored to one job post, with its estimated ATS score."
        status={status}
      >
        A tailored CV only uses facts from your confirmed profile, so tailoring starts once you confirm it.
      </NeedsProfile>
    );
  }
  const user = await requireUser();
  const row = await getTailoring(user.id, (await params).id);
  if (!row?.tailored || !row.jobSpec || !row.atsTailored || !row.latex) notFound();
  const profile = await getProfileVersion(user.id, row.profileVersion);
  if (!profile) notFound();

  const spec = row.jobSpec;
  const matchedTerms = new Set(row.atsTailored.matched.map((m) => m.term));
  const keywords = spec.keywords.filter((k) => k.kind !== "title");
  const changes = cvChanges(profile, row.tailored);
  const roleCompanies = new Set(profile.experience.map((e) => e.company));
  const result: TailorResult = {
    job: { title: spec.title, company: spec.company ?? "", text: row.jdClean },
    marks: jobMarks(
      row.jdClean,
      keywords.filter((k) => matchedTerms.has(k.term)),
      keywords.filter((k) => !matchedTerms.has(k.term)),
    ),
    cv: buildCvDocument(profile, row.tailored),
    latex: row.latex,
    changes,
    score: row.atsTailored.score,
    master: row.atsMaster?.score ?? row.atsTailored.score,
    parts: row.atsTailored.components,
    matched: row.atsTailored.matched.map((m) => m.term),
    missing: row.atsTailored.missing.map((m) => m.term),
    // Role bullets left out, with why (projects not chosen are only in Changes).
    removed: changes
      .filter((c) => c.kind === "dropped" && roleCompanies.has(c.where))
      .map((c) => (c.kind === "dropped" ? { where: c.where, text: c.text, reason: c.reason } : null))
      .filter((x): x is { where: string; text: string; reason: string } => x !== null),
  };
  const slug = [profile.basics.name, spec.company]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return <TailorResultView result={result} newPostHref="/tailor" fileName={`${slug || "resume"}.tex`} />;
}
