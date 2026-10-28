import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails } from "@/lib/auth/allowlist";

describe("allowlist", () => {
  it("parses comma, space and semicolon separated emails, case-insensitively", () => {
    expect([...parseAllowedEmails(" A@example.com, b@example.com;c@example.com  d@example.com ")]).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
    ]);
  });

  it("allows listed emails regardless of case", () => {
    expect(isAllowedEmail("Allowed@Example.com", "allowed@example.com")).toBe(true);
  });

  it("refuses everything when the list is empty or missing", () => {
    expect(isAllowedEmail("a@example.com", "")).toBe(false);
    expect(isAllowedEmail("a@example.com", undefined)).toBe(false);
  });

  it("refuses unlisted, empty and look-alike emails", () => {
    expect(isAllowedEmail("other@example.com", "allowed@example.com")).toBe(false);
    expect(isAllowedEmail("", "allowed@example.com")).toBe(false);
    expect(isAllowedEmail(null, "allowed@example.com")).toBe(false);
    expect(isAllowedEmail("allowed@example.com.evil.test", "allowed@example.com")).toBe(false);
  });
});
