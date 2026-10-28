/** ALLOWED_EMAILS is a comma separated list set by the owner in env, never in code. */
export function parseAllowedEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export function isAllowedEmail(
  email: string | null | undefined,
  raw: string | undefined = process.env.ALLOWED_EMAILS,
): boolean {
  if (!email) return false;
  return parseAllowedEmails(raw).has(email.trim().toLowerCase());
}
