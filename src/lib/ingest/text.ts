/**
 * Clean-up shared by every extractor: Unicode NFC, LF line endings, no
 * trailing spaces, at most one blank line in a row, and line-end hyphens
 * joined when the joined word appears elsewhere in the document.
 */
export function normalizeExtractedText(raw: string): string {
  let text = raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​﻿]/g, "")
    .replace(/[ \t]+$/gm, "");

  const words = new Set(text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? []);
  text = text.replace(/([A-Za-z]+)-\n([a-z][a-z0-9]*)/g, (whole, a: string, b: string) =>
    words.has((a + b).toLowerCase()) ? `${a}${b}` : `${a}-${b}`,
  );

  return text.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Characters that are not whitespace: used to spot PDFs with no text layer. */
export function visibleCharCount(text: string): number {
  return text.replace(/\s+/g, "").length;
}
