/**
 * CV dates in the profile are "YYYY-MM", "YYYY" or "present". These helpers
 * normalize what CVs and models write ("Mar 2024", "June 2023", "03/2024",
 * "Current") and format them back for display ("Mar 2024", "Present").
 */

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseCvDate(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase().replace(/\.$/, "");
  if (!s) return null;
  if (/^(present|current|now|today|ongoing)$/.test(s)) return "present";
  let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = /^([a-z]{3,9})\.?,?\s+(\d{4})$/.exec(s);
  if (m) {
    // "Mar", "March" and "Sept" all count; "Marching" does not.
    const idx = MONTH_NAMES.findIndex((full) => full.startsWith(m![1]) && m![1].length >= 3);
    if (idx >= 0) return `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
  }
  if (/^\d{4}$/.test(s)) return s;
  return null;
}

/** "2024-03" to "Mar 2024", "2019" to "2019", "present" to "Present". */
export function formatCvDate(value: string | undefined): string {
  if (!value) return "";
  if (value === "present") return "Present";
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (m) return `${MONTH_LABELS[+m[2] - 1]} ${m[1]}`;
  return value;
}

/** Comparable number for sorting: "present" sorts last. */
export function dateSortKey(value: string | undefined): number {
  if (!value) return 0;
  if (value === "present") return 999_912;
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(value);
  return m ? +m[1] * 100 + (m[2] ? +m[2] : 0) : 0;
}
