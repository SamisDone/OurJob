import { describe, expect, it } from "vitest";
import { activeNavHref, crumbsFor } from "@/components/shell/nav";

describe("shell navigation", () => {
  it("lights up the parent of detail pages", () => {
    expect(activeNavHref("/jobs/abc")).toBe("/today");
    expect(activeNavHref("/tailor/abc")).toBe("/tailor");
    expect(activeNavHref("/onboarding")).toBe("/profile");
    expect(activeNavHref("/settings")).toBe("/settings");
    expect(activeNavHref("/no-such-page")).toBeNull();
  });

  it("builds breadcrumbs from the route", () => {
    expect(crumbsFor("/today")).toEqual([{ label: "Today" }]);
    expect(crumbsFor("/tailor/abc")).toEqual([{ label: "Tailor", href: "/tailor" }, { label: "Tailored CV" }]);
    expect(crumbsFor("/jobs/abc")).toEqual([{ label: "Today", href: "/today" }, { label: "Job" }]);
    expect(crumbsFor("/no-such-page")).toEqual([]);
  });
});
