import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTexCv, texCvToText, type TexEntry } from "@/lib/ingest/tex";
import { encodeLatinChar } from "@/lib/latex/accents";
import { latexInline, latexToPlain } from "@/lib/latex/inline";

const sample = readFileSync("templates/resume-sample.tex", "utf8");
const meiLin = readFileSync("tests/fixtures/cvs/sources/mei-lin-tan.tex", "utf8");

describe("latexInline", () => {
  it("unescapes LaTeX specials", () => {
    expect(latexToPlain(String.raw`35\% faster, R\&D, issue \#3, \$5, a\_b, $\sim$10x, A $|$ B`)).toBe(
      "35% faster, R&D, issue #3, $5, a_b, ~10x, A | B",
    );
  });

  it("keeps bold spans and drops other styling", () => {
    const r = latexInline(String.raw`Built the \textbf{real-time dashboard} in \emph{React}`);
    expect(r.segments).toEqual([
      { text: "Built the " },
      { text: "real-time dashboard", bold: true },
      { text: " in React" },
    ]);
  });

  it("decodes accent commands to Unicode", () => {
    expect(
      latexToPlain(String.raw`Jos\'{e} M\"uller, Pe\~{n}a, Fran\c{c}ois, Stra\ss{}e, Ji\v{r}\'{\i}, \L{}\'{o}d\'{z}`),
    ).toBe("José Müller, Peña, François, Straße, Jiří, Łódź");
  });

  it("turns -- into an en dash and never outputs an em dash", () => {
    expect(latexToPlain("Mar 2024 -- Present, a --- b")).toBe("Mar 2024 – Present, a – b");
  });

  it("collects links from \\lnk and \\href", () => {
    const r = latexInline(String.raw`\lnk{https://example.com/a}{Live} $|$ \href{https://example.com/b\#x}{Source}`);
    expect(r.links).toEqual([
      { url: "https://example.com/a", label: "Live" },
      { url: "https://example.com/b#x", label: "Source" },
    ]);
  });
});

describe("encodeLatinChar", () => {
  it.each([
    ["é", String.raw`\'{e}`],
    ["ü", String.raw`\"{u}`],
    ["ñ", String.raw`\~{n}`],
    ["ç", String.raw`\c{c}`],
    ["í", String.raw`\'{\i}`],
    ["ř", String.raw`\v{r}`],
    ["ß", String.raw`\ss{}`],
    ["ø", String.raw`\o{}`],
    ["Ł", String.raw`\L{}`],
  ])("encodes %s", (ch, expected) => {
    expect(encodeLatinChar(ch)).toBe(expected);
  });

  it("round-trips through the importer", () => {
    for (const ch of "éèêëüñçíìřšžőąłøåæßÉÜÑŠ") {
      expect(latexToPlain(encodeLatinChar(ch)!)).toBe(ch);
    }
  });

  it("returns null for scripts it cannot encode", () => {
    expect(encodeLatinChar("ক")).toBeNull();
    expect(encodeLatinChar("a")).toBeNull();
  });
});

describe("parseTexCv on templates/resume-sample.tex", () => {
  const cv = parseTexCv(sample)!;

  it("reads the header", () => {
    expect(cv.name).toBe("Nadia Chowdhury");
    expect(cv.contact.location).toBe("Sylhet, Bangladesh");
    expect(cv.contact.email).toBe("nadia.chowdhury@example.com");
    expect(cv.contact.links.map((l) => l.label)).toEqual(["Github", "LinkedIn"]);
  });

  it("finds every section in order", () => {
    expect(cv.sections.map((s) => [s.title, s.kind])).toEqual([
      ["Summary", "text"],
      ["Technical Skills", "skills"],
      ["Professional Experience", "entries"],
      ["Projects", "entries"],
      ["Education", "entries"],
    ]);
  });

  it("reads the summary", () => {
    const s = cv.sections[0];
    expect(s.kind === "text" && s.text).toBe(
      "Backend Engineer with 5+ years of experience designing Go and Python services, PostgreSQL schemas and event pipelines for logistics and payments products.",
    );
  });

  it("reads skill groups", () => {
    const s = cv.sections[1];
    expect(s.kind === "skills" && s.groups).toEqual([
      { group: "Languages", items: ["Go", "Python", "SQL"] },
      { group: "Data", items: ["PostgreSQL", "Redis"] },
      { group: "Backend", items: ["gRPC", "Kafka", "REST APIs", "Django", "Celery"] },
      { group: "Infrastructure", items: ["Docker", "Kubernetes", "AWS", "GitHub Actions"] },
    ]);
  });

  it("reads roles with links, dates, bold phrases and tech", () => {
    const s = cv.sections[2];
    if (s.kind !== "entries") throw new Error("expected entries");
    const [a, b] = s.entries as Extract<TexEntry, { kind: "role" }>[];
    expect(a).toMatchObject({
      org: "Parcelwise",
      title: "Senior Backend Engineer",
      right: "Jun 2023 – Present",
      tech: ["Go", "PostgreSQL", "Kafka", "Redis", "Docker", "Kubernetes", "gRPC"],
    });
    expect(a.orgUrl).toBeUndefined();
    expect(a.bullets).toHaveLength(1);
    expect(a.bullets[0].text).toContain("cut failed invoice runs by roughly 60%.");
    expect(a.bullets[0].boldPhrases).toEqual(["rate-quote service", "1,200 requests per second", "Kafka", "60%"]);
    expect(b).toMatchObject({ org: "Taka Pay", title: "Backend Developer", right: "Feb 2020 – May 2023" });
  });

  it("reads an employer linked to its website", () => {
    const linked = sample.replace(
      String.raw`{\underline{Parcelwise}{}}`,
      String.raw`{\lnk{https://example.com/parcelwise}{Parcelwise \& Co.}}`,
    );
    const s = parseTexCv(linked)!.sections[2];
    if (s.kind !== "entries") throw new Error("expected entries");
    expect(s.entries[0]).toMatchObject({ org: "Parcelwise & Co.", orgUrl: "https://example.com/parcelwise" });
  });

  it("reads projects with their links", () => {
    const s = cv.sections[3];
    if (s.kind !== "entries") throw new Error("expected entries");
    expect(s.entries.map((e) => (e.kind === "project" ? [e.name, e.links.map((l) => l.label)] : null))).toEqual([
      ["pgwatch-lite", ["Source"]],
    ]);
  });

  it("reads education", () => {
    const s = cv.sections[4];
    expect(s.kind === "entries" && s.entries[0]).toMatchObject({
      org: "Shahjalal University of Science and Technology",
      title: "B.Sc. in Computer Science",
      right: "Sylhet, Bangladesh",
    });
  });

  it("renders readable text for P1 with bold marked", () => {
    const text = texCvToText(cv);
    expect(text).toContain("### Parcelwise | Senior Backend Engineer | Jun 2023 – Present");
    expect(text).toContain("**2,000+ merchants**");
    expect(text).toContain("samples pg_stat_statements");
    expect(text).not.toMatch(/\\[a-zA-Z]/);
  });
});

describe("parseTexCv on a second fictional CV", () => {
  const cv = parseTexCv(meiLin)!;

  it("handles escaped characters and a second bullet per role", () => {
    expect(cv.name).toBe("Mei Lin Tan");
    const exp = cv.sections.find((s) => s.title === "Professional Experience");
    if (exp?.kind !== "entries") throw new Error("expected entries");
    expect(exp.entries).toHaveLength(2);
    expect(exp.entries[1]).toMatchObject({ org: "Lantern & Ledger", right: "Jan 2019 – Jul 2022" });
    expect(exp.entries[1].bullets[1].text).toBe(
      "Introduced React Testing Library and raised frontend test coverage from 35% to 80%.",
    );
    const projects = cv.sections.find((s) => s.title === "Projects");
    expect(projects?.kind === "entries" && projects.entries[0].bullets[0].text).toContain("#3 on a design newsletter");
  });

  it("returns null for a file that is not a CV in this layout", () => {
    expect(parseTexCv(String.raw`\documentclass{article}\begin{document}Hello\end{document}`)).toBeNull();
  });
});
