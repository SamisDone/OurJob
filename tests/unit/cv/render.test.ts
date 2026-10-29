import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCvDocument, dateRange, formatMonth } from "@/lib/cv/build";
import { escapeLatex, escapeUrl, PREAMBLE, renderLatex } from "@/lib/latex/render";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "@/lib/profile/normalize";
import type { TailoredResume } from "@/lib/profile/schema";

const template = readFileSync("templates/resume-sample.tex", "utf8").replace(/\r\n/g, "\n");
const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);

describe("LaTeX renderer", () => {
  it("copies the template's preamble exactly", () => {
    const start = template.indexOf("\\documentclass");
    // Up to the comment line just before \begin{document}.
    const end = template.lastIndexOf("\n%", template.indexOf("\\begin{document}")) + 1;
    expect(PREAMBLE).toBe(template.slice(start, end));
  });

  it("escapes every LaTeX special character", () => {
    expect(escapeLatex("R&D 50% $5 #1 a_b {x} ~ ^ \\ <a> | –")).toBe(
      "R\\&D 50\\% \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{} \\textless{}a\\textgreater{} \\textbar{} --",
    );
    expect(escapeUrl("https://x.example/a_b?q=1%20#top")).toBe("https://x.example/a_b?q=1\\%20\\#top");
  });

  it("formats dates as the template does", () => {
    expect(formatMonth("2023-06")).toBe("Jun 2023");
    expect(formatMonth("present")).toBe("Present");
    expect(dateRange("2020-02", "2023-05")).toBe("Feb 2020 – May 2023");
  });

  it("renders the master CV in the template's structure", () => {
    const tex = renderLatex(buildCvDocument(profile));
    expect(tex.startsWith(PREAMBLE)).toBe(true);
    expect(tex).toContain("{\\huge \\scshape Nadia Chowdhury} \\\\ \\vspace{2pt}");
    expect(tex).toContain("\\lnk{mailto:nadia.chowdhury@example.com}{nadia.chowdhury@example.com}");
    expect(tex).toContain("\\section{Professional Experience}");
    expect(tex).toMatch(
      /\\resumeSubheading\n {6}\{\\underline\{Parcelwise\}\{\}\}\{Senior Backend Engineer\}\{Jun 2023 -- Present\}/,
    );
    expect(tex).toContain("\\tech{Go, PostgreSQL, Kafka, Redis, Docker, Kubernetes, gRPC}");
    expect(tex).toContain("\\resumeProjectHeading");
    expect(tex).toContain("{Shahjalal University of Science and Technology}{B.Sc. in Computer Science}");
    expect(tex.trim().endsWith("\\end{document}")).toBe(true);
    // Braces balance, so the file at least parses.
    const open = (tex.match(/(?<!\\)\{/g) ?? []).length;
    const close = (tex.match(/(?<!\\)\}/g) ?? []).length;
    expect(open).toBe(close);
  });

  it("renders a tailored CV from its own bullets, order and bold phrases", () => {
    const t: TailoredResume = {
      headline: "Backend Engineer",
      summary: { text: "Backend Engineer with 5+ years of experience.", sourceIds: ["summary"] },
      sections: ["summary", "experience", "skills", "education"],
      skills: [{ group: "Languages", items: [{ name: "Go", skillId: "sk_go" }] }],
      experience: [
        {
          experienceId: "exp_1",
          bullets: [
            {
              text: "Moved billing to Kafka, cutting failures by roughly 60%.",
              boldPhrases: ["Kafka", "60%"],
              sourceIds: ["b_1_2"],
              keywordsUsed: ["Kafka"],
            },
          ],
          tech: ["Kafka", "Go"],
        },
      ],
      projects: [],
      educationIds: ["edu_1"],
      certificationIds: [],
      awardIds: [],
      notes: [],
    };
    const tex = renderLatex(buildCvDocument(profile, t));
    expect(tex).toContain(
      "\\resumeItem{Moved billing to \\textbf{Kafka}, cutting failures by roughly \\textbf{60\\%}.}",
    );
    expect(tex).toContain("\\tech{Kafka, Go}");
    expect(tex).not.toContain("Taka Pay");
    expect(tex.indexOf("\\section{Professional Experience}")).toBeLessThan(tex.indexOf("\\section{Technical Skills}"));
  });
});
