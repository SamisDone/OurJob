import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { safeFetch } from "@/lib/http/ssrf";
import { IngestError } from "./errors";
import { normalizeExtractedText, visibleCharCount } from "./text";

/**
 * Portfolio site: fetched once through the SSRF guard, main text extracted.
 * Sites that render in the browser return almost no text; then `thin` is set
 * so the UI can offer a paste box instead.
 */

const MIN_USEFUL_CHARS = 300;

export type PortfolioImport = {
  url: string;
  title: string | null;
  text: string;
  /** Under 300 characters: the site likely renders in the browser. */
  thin: boolean;
  links: { label: string; url: string }[];
};

export function extractMainText(html: string, pageUrl: string): Omit<PortfolioImport, "url" | "thin"> {
  const { document } = parseHTML(html);
  const links = Array.from(document.querySelectorAll("a[href]"))
    .map((a) => {
      try {
        return { label: (a.textContent ?? "").trim(), url: new URL(a.getAttribute("href") ?? "", pageUrl).toString() };
      } catch {
        return null;
      }
    })
    .filter((l): l is { label: string; url: string } => !!l && /^https?:/.test(l.url) && l.label.length > 0)
    .filter((l, i, all) => all.findIndex((x) => x.url === l.url) === i)
    .slice(0, 60);

  // Readability mutates the document, so links are read first.
  for (const el of Array.from(document.querySelectorAll("script,style,noscript,template,svg"))) el.remove();
  const article = new Readability(document as unknown as Document, { charThreshold: 100 }).parse();
  const text = normalizeExtractedText(article?.textContent ?? document.body?.textContent ?? "");
  return { title: article?.title?.trim() || document.title?.trim() || null, text, links };
}

export async function importPortfolio(url: string): Promise<PortfolioImport> {
  const res = await safeFetch(url);
  if (!/html|xml/i.test(res.contentType)) {
    throw new IngestError("unsupported_type", "That address is not a web page. Use the link to your portfolio's home page.");
  }
  const main = extractMainText(res.body, res.url);
  return { url: res.url, ...main, thin: visibleCharCount(main.text) < MIN_USEFUL_CHARS };
}
