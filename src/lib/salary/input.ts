/**
 * Reads an amount a person types: "40k", "40,000", "40000", "$40k",
 * "40.5k", "40 000". Returns undefined for empty input and null when it is
 * not an amount, so the form can say so.
 */
export function parseAmountInput(raw: string): number | undefined | null {
  const s = raw.trim().toLowerCase().replace(/^(usd|us\$|\$)\s*/, "").replace(/\s*(usd|a year|\/year|per year)$/, "");
  if (!s) return undefined;
  const m = /^(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d+))?\s*(k)?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1].replace(/[,\s]/g, ""));
  const frac = m[2] ? Number(`0.${m[2]}`) : 0;
  const value = (whole + frac) * (m[3] ? 1000 : 1);
  if (!m[3] && frac) return null;
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function formatAmount(n: number | undefined): string {
  return n === undefined ? "" : n.toLocaleString("en-US");
}
