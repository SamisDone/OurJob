/**
 * Maps the two tailoring mutations (parse, then tailor) to the named steps
 * the workspace shows: "Reading the job", then "Tailoring your CV". Never a
 * spinner on its own (DESIGN.md 5.4).
 */

export type MutationStatus = "idle" | "pending" | "success" | "error";
export type StepState = "todo" | "running" | "done" | "failed";

export function tailorSteps(parse: MutationStatus, tailor: MutationStatus) {
  const parseState: StepState =
    parse === "pending" ? "running" : parse === "success" ? "done" : parse === "error" ? "failed" : "todo";
  const tailorState: StepState =
    tailor === "pending" ? "running" : tailor === "success" ? "done" : tailor === "error" ? "failed" : "todo";
  return [
    { label: "Reading the job", state: parseState },
    { label: "Tailoring your CV", state: tailorState },
  ] as const;
}
