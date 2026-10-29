import type { MasterProfile, TailoredResume } from "@/lib/profile/schema";
import type { CvSections } from "./match";

/** The master CV as matcher sections: everything in the profile. */
export function profileSections(p: MasterProfile): CvSections {
  return {
    headline: [p.basics.headline ?? ""].filter(Boolean),
    summary: [p.basics.summary?.text ?? ""].filter(Boolean),
    skills: p.skills.map((s) => [s.name, ...s.aliases].join(", ")),
    experience: p.experience.flatMap((e) => [...e.bullets.map((b) => b.text), e.tech.join(", ")]),
    projects: p.projects.flatMap((pr) => [pr.description, ...pr.bullets.map((b) => b.text), pr.tech.join(", ")]),
    education: p.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(", ")),
    other: [...p.certifications.map((c) => c.name), ...p.awards.map((a) => a.text)],
  };
}

/** A tailored CV as matcher sections: only what the rendered CV will show. */
export function tailoredSections(t: TailoredResume, p: MasterProfile): CvSections {
  const edu = new Set(t.educationIds);
  const certs = new Set(t.certificationIds);
  const awards = new Set(t.awardIds);
  return {
    headline: [t.headline],
    summary: t.summary ? [t.summary.text] : [],
    skills: t.skills.map((g) => g.items.map((i) => i.name).join(", ")),
    experience: t.experience.flatMap((e) => [...e.bullets.map((b) => b.text), e.tech.join(", ")]),
    projects: t.projects.flatMap((pr) => [...pr.bullets.map((b) => b.text), pr.tech.join(", ")]),
    education: p.education
      .filter((e) => edu.has(e.id))
      .map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(", ")),
    other: [
      ...p.certifications.filter((c) => certs.has(c.id)).map((c) => c.name),
      ...p.awards.filter((a) => awards.has(a.id)).map((a) => a.text),
    ],
  };
}
