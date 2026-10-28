import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IngestError } from "@/lib/ingest/errors";
import { docxHtmlToText, extractUpload, MAX_UPLOAD_BYTES } from "@/lib/ingest/files";
import { normalizeExtractedText } from "@/lib/ingest/text";

const fixture = (p: string) => new Uint8Array(readFileSync(`tests/fixtures/${p}`));

/** Asserts each fact appears in the text, in this order. Line wraps count as spaces. */
function expectInOrder(raw: string, facts: string[]) {
  const text = raw.replace(/\s+/g, " ");
  let from = 0;
  for (const fact of facts) {
    const at = text.indexOf(fact, from);
    expect(at, `"${fact}" after position ${from}`).toBeGreaterThanOrEqual(0);
    from = at + fact.length;
  }
}

describe("extractUpload", () => {
  it("reads the Markdown CV with every role, project, degree and date", async () => {
    const r = await extractUpload("nadia-chowdhury.md", fixture("cvs/nadia-chowdhury.md"));
    expect(r.kind).toBe("cv_md");
    expectInOrder(r.text, [
      "Nadia Chowdhury",
      "Senior Backend Engineer, Parcelwise",
      "Jun 2023 - Present",
      "p99 under 80 ms",
      "roughly 60%",
      "Backend Developer, Taka Pay",
      "Feb 2020 - May 2023",
      "2,000+ merchants",
      "pgwatch-lite",
      "Shahjalal University of Science and Technology",
      "2015 - 2019",
      "AWS Certified Developer - Associate",
    ]);
  });

  it("reads the DOCX CV with headings, bullets, accents and links", async () => {
    const r = await extractUpload("tomas-herrera.docx", fixture("cvs/tomas-herrera.docx"));
    expect(r.kind).toBe("cv_docx");
    expectInOrder(r.text, [
      "# Tomás Herrera Núñez",
      "Valparaíso, Chile",
      "## Experience",
      "### Full Stack Developer, Cerro Alegre Studio",
      "Mar 2022 - Present",
      "- Rebuilt the donation checkout",
      "an estimated ~25%",
      "15k tickets a month",
      "### Junior Web Developer, Puerto Digital",
      "Jan 2021 - Feb 2022",
      "20+ WordPress and PHP sites",
      "C# integration",
      "### Feria",
      "https://github.com/example-tomas/feria",
      "Ingeniería en Informática, Universidad Técnica del Pacífico",
      "Spanish (native), English (professional)",
    ]);
    expect(r.text).toContain("small businesses & non-profits");
  });

  it("reads the LaTeX-built PDF CV in reading order", async () => {
    const r = await extractUpload("mei-lin-tan.pdf", fixture("cvs/mei-lin-tan.pdf"));
    expect(r.kind).toBe("cv_pdf");
    expect(r.pages).toBe(1);
    expectInOrder(r.text, [
      "Mei Lin Tan",
      "Penang, Malaysia",
      "Frontend Engineer with 6 years",
      "Kopi Health | Senior Frontend Engineer Aug 2022 – Present",
      "60+ components",
      "4.1 s to 1.3 s",
      "Lantern & Ledger | Frontend Developer Jan 2019 – Jul 2022",
      "12,000 retail investors",
      "35% to 80%",
      "Contrast Kit",
      "#3 on a design newsletter",
      "Universiti Sains Contoh | B.Sc. in Software Engineering 2014 – 2018",
    ]);
  });

  it("reads the LinkedIn-style export and joins hyphenated words it can verify", async () => {
    const r = await extractUpload("profile.pdf", fixture("linkedin/nadia-chowdhury-linkedin.pdf"), { linkedin: true });
    expect(r.kind).toBe("linkedin_pdf");
    expectInOrder(r.text, [
      "Top Skills",
      "Terraform",
      "Nadia Chowdhury",
      "Parcelwise",
      "June 2023 - Present",
      "Taka Pay",
      "February 2020 - April 2023",
    ]);
    expect(r.text).toContain("Infrastructure in Terraform.");
  });

  it("rejects a PDF with no text layer with the agreed message", async () => {
    await expect(extractUpload("scan.pdf", fixture("cvs/scanned-no-text.pdf"))).rejects.toMatchObject({
      code: "no_text_layer",
      message: "This PDF has no selectable text. Upload the DOCX or a text-based PDF.",
    });
  });

  it("rejects files over 5 MB before reading them", async () => {
    await expect(extractUpload("big.pdf", new Uint8Array(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("rejects a renamed file whose bytes do not match its extension", async () => {
    await expect(extractUpload("cv.pdf", fixture("cvs/tomas-herrera.docx"))).rejects.toBeInstanceOf(IngestError);
    await expect(extractUpload("cv.docx", fixture("cvs/mei-lin-tan.pdf"))).rejects.toMatchObject({
      code: "unreadable",
    });
  });

  it("rejects unsupported types and non-PDF LinkedIn uploads", async () => {
    await expect(extractUpload("cv.pages", new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
      code: "unsupported_type",
    });
    await expect(extractUpload("li.md", fixture("cvs/nadia-chowdhury.md"), { linkedin: true })).rejects.toMatchObject({
      code: "unsupported_type",
    });
  });

  it("parses a .tex upload structurally and falls back to raw text otherwise", async () => {
    const tex = await extractUpload("cv.tex", new Uint8Array(readFileSync("templates/resume-sample.tex")));
    expect(tex.tex?.name).toBe("Arif Rahman");
    expect(tex.text).toContain("**35%**");
    const other = await extractUpload(
      "notes.tex",
      new TextEncoder().encode("\\begin{document}Just notes\\end{document}"),
    );
    expect(other.tex).toBeUndefined();
    expect(other.text).toContain("Just notes");
  });
});

describe("normalizeExtractedText", () => {
  it("joins a hyphenated line break only when the joined word appears elsewhere", () => {
    expect(normalizeExtractedText("Uses Terraform.\nInfra in Ter-\nraform")).toContain("Infra in Terraform");
    expect(normalizeExtractedText("Certified Developer – Asso-\nciate")).toContain("Asso-ciate");
  });

  it("keeps real hyphens and collapses blank lines", () => {
    expect(normalizeExtractedText("Full-Stack Engineer\r\n\r\n\r\n\r\nNext   ")).toBe("Full-Stack Engineer\n\nNext\n");
  });
});

describe("docxHtmlToText", () => {
  it("keeps headings, nested lists, bold and links", () => {
    const html =
      '<h2>Experience</h2><p>Built the <strong>rate-quote service</strong> in Go</p><ul><li>One<ul><li>Nested</li></ul></li></ul><p><a href="https://example.com">Site</a></p>';
    expect(docxHtmlToText(html)).toBe(
      "\n## Experience\nBuilt the **rate-quote service** in Go\n- One\n- Nested\nSite (https://example.com)",
    );
  });
});
