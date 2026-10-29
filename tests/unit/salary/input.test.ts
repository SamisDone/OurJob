import { describe, expect, it } from "vitest";
import { formatAmount, parseAmountInput } from "@/lib/salary/input";

describe("parseAmountInput", () => {
  it.each([
    ["40k", 40000],
    ["40K", 40000],
    ["40,000", 40000],
    ["40000", 40000],
    ["40 000", 40000],
    ["$40k", 40000],
    ["USD 40,000", 40000],
    ["40.5k", 40500],
    ["120k a year", 120000],
    ["1,250,000", 1250000],
  ])("reads %j as %d", (input, out) => expect(parseAmountInput(input)).toBe(out));

  it("treats empty input as no minimum", () => {
    expect(parseAmountInput("")).toBeUndefined();
    expect(parseAmountInput("   ")).toBeUndefined();
  });

  it.each(["forty", "40,00", "4,0000", "-40k", "40.5", "0", "40kk"])("rejects %j", (input) =>
    expect(parseAmountInput(input)).toBeNull(),
  );

  it("formats for display", () => expect(formatAmount(40000)).toBe("40,000"));
});
