import mammoth from "mammoth";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import { IngestError } from "./errors";
import { parseTexCv, texCvToText, type ParsedTexCv } from "./tex";
import { normalizeExtractedText, visibleCharCount } from "./text";

/**
 * Text extraction for uploaded CV and LinkedIn files. PDF via unpdf, DOCX via
 * mammoth (converted to HTML so headings, lists and bold survive), Markdown
 * as is, LaTeX via the structural parser. See DECISIONS.md for the choices.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadKind = "cv_tex" | "cv_pdf" | "cv_docx" | "cv_md" | "linkedin_pdf";

export type Extracted = {
  kind: UploadKind;
  text: string;
  pages?: number;
  /** Present for .tex uploads that matched the template structure. */
  tex?: ParsedTexCv;
};

/** Below this many visible characters per page, a PDF is treated as scanned. */
const MIN_CHARS_PER_PAGE = 60;

export async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  let result: { text: string; totalPages: number };
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    result = await extractText(doc, { mergePages: true });
  } catch {
    throw new IngestError("unreadable", "This PDF could not be read. Export it again, or upload the DOCX.");
  }
  const text = normalizeExtractedText(result.text);
  if (visibleCharCount(text) < MIN_CHARS_PER_PAGE * Math.max(1, result.totalPages)) {
    throw new IngestError("no_text_layer", "This PDF has no selectable text. Upload the DOCX or a text-based PDF.");
  }
  return { text, pages: result.totalPages };
}

/** Converts mammoth's HTML to Markdown-like text: # headings, - list items, **bold**. */
export function docxHtmlToText(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const lines: string[] = [];
  const inline = (el: Element): string => {
    let out = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === 3) out += node.textContent ?? "";
      else if (node.nodeType === 1) {
        const child = node as Element;
        const tag = child.tagName.toLowerCase();
        const inner = inline(child);
        if ((tag === "strong" || tag === "b") && inner.trim()) {
          // Keep surrounding spaces outside the markers: "**Go** service", not "** Go **".
          const lead = /^\s/.test(inner) ? " " : "";
          const trail = /\s$/.test(inner) ? " " : "";
          out += `${lead}**${inner.trim()}**${trail}`;
        } else if (tag === "a") {
          const href = child.getAttribute("href");
          out += href && href !== inner && !href.startsWith("#") ? `${inner} (${href})` : inner;
        } else if (tag === "br") out += "\n";
        else out += inner;
      }
    });
    return out;
  };
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) lines.push("", `${"#".repeat(Number(tag[1]))} ${inline(child).trim()}`);
      else if (tag === "p") lines.push(inline(child).trim());
      else if (tag === "li") {
        const nested = Array.from(child.children).filter((c) => /^(ul|ol)$/i.test(c.tagName));
        nested.forEach((n) => n.remove());
        lines.push(`- ${inline(child).trim()}`);
        nested.forEach((n) => walk(n));
      } else if (tag === "table") {
        for (const row of Array.from(child.querySelectorAll("tr"))) {
          lines.push(
            Array.from(row.querySelectorAll("td,th"))
              .map((c) => inline(c).trim())
              .join(" | "),
          );
        }
      } else walk(child);
    }
  };
  walk(document.body);
  return lines.join("\n");
}

export async function extractDocx(bytes: Uint8Array): Promise<string> {
  try {
    const { value } = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      // Never follow links to files outside the upload.
      { externalFileAccess: false },
    );
    return normalizeExtractedText(docxHtmlToText(value));
  } catch {
    throw new IngestError(
      "unreadable",
      "This DOCX could not be read. Save it again from Word or Google Docs and retry.",
    );
  }
}

function sniff(bytes: Uint8Array): "pdf" | "zip" | "text" {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"; // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip"; // PK (docx)
  return "text";
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new IngestError("unreadable", "This file is not UTF-8 text. Save it as UTF-8 and upload it again.");
  }
}

/**
 * Extracts text from an upload. The extension says what the person meant to
 * upload; the first bytes must agree, so a renamed file is caught early.
 */
export async function extractUpload(
  filename: string,
  bytes: Uint8Array,
  opts: { linkedin?: boolean } = {},
): Promise<Extracted> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new IngestError("too_large", "This file is over 5 MB. Upload a smaller export.");
  }
  if (bytes.byteLength === 0) throw new IngestError("empty", "This file is empty.");

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const magic = sniff(bytes);

  if (ext === "pdf") {
    if (magic !== "pdf") throw new IngestError("unreadable", "This file is named .pdf but is not a PDF.");
    const { text, pages } = await extractPdf(bytes);
    return { kind: opts.linkedin ? "linkedin_pdf" : "cv_pdf", text, pages };
  }
  if (opts.linkedin) {
    throw new IngestError("unsupported_type", "Upload the PDF from LinkedIn's Save to PDF.");
  }
  if (ext === "docx") {
    if (magic !== "zip") throw new IngestError("unreadable", "This file is named .docx but is not a Word document.");
    return { kind: "cv_docx", text: await extractDocx(bytes) };
  }
  if (ext === "md" || ext === "markdown" || ext === "txt") {
    const text = normalizeExtractedText(decodeText(bytes));
    if (!text.trim()) throw new IngestError("empty", "This file is empty.");
    return { kind: "cv_md", text };
  }
  if (ext === "tex") {
    const source = decodeText(bytes);
    const tex = parseTexCv(source);
    // Fall back to the raw source when the file does not follow the template's macros.
    return tex
      ? { kind: "cv_tex", text: texCvToText(tex), tex }
      : { kind: "cv_tex", text: normalizeExtractedText(source) };
  }
  throw new IngestError("unsupported_type", "Upload a PDF, DOCX, Markdown or LaTeX (.tex) file.");
}
