import { z } from "zod";
import { tailoredBulletSchema, type JobSpec, type MasterProfile, type TailoredResume } from "@/lib/profile/schema";
import type { GapKeyword, MatchedKeyword } from "@/lib/tailor/keywords";
import { p3System, promptProfile, type TailorOptions } from "./p3-tailor";

/**
 * The validator's fix loop (docs/AI_PROMPTS.md): only the failing items go
 * back to the model, with the exact errors, and only changes come back.
 */
export const P3_FIX_PROMPT_ID = "p3-fix";
export const P3_FIX_PROMPT_VERSION = "p3fix.2";

export const p3FixOutputSchema = z.object({
  changes: z.array(
    z.object({
      ref: z
        .string()
        .describe(
          'A ref from <problems>: "summary", "experience:<id>:<n>" or "projects:<id>:<n>"; for "add", "experience:<id>" or "projects:<id>"',
        ),
      action: z.enum(["replace", "remove", "add"]),
      bullet: tailoredBulletSchema.optional().describe("For replace or add on a bullet ref"),
      summary: z
        .object({ text: z.string(), sourceIds: z.array(z.string()) })
        .optional()
        .describe("For replace on summary"),
    }),
  ),
});
export type P3FixOutput = z.infer<typeof p3FixOutputSchema>;

export function p3FixPrompt(args: {
  profile: MasterProfile;
  spec: JobSpec;
  matched: MatchedKeyword[];
  gaps: GapKeyword[];
  opts: TailorOptions;
  resume: TailoredResume;
  problems: { ref: string; current?: string; errors: string[] }[];
}) {
  const system = `${p3System(args.opts)}

You are now correcting a CV you already tailored. <problems> lists items that failed the fact check, each with its ref, its current text and the errors.
For each problem return a change:
- "replace" with a corrected bullet (or summary) that fixes every error and still follows all rules above. When a number or claim is not supported, remove it or use the exact wording of the source; never invent a replacement.
- "remove" when the item cannot be fixed without adding facts.
- "add" a bullet to a role or project (ref "experience:<id>" or "projects:<id>") only to place a missing matched keyword where its proofIds support it, to add a role, or to restore a left-out source bullet.
For length problems, shorten bullets first, then drop the least relevant projects; remove a role bullet only if it is clearly irrelevant to the job. For "Keep ..." problems, add the named source bullet back as a tailored bullet to that role (ref "experience:<id>"), reworded for the job.
Return only changes.`;
  const user = [
    `<master_profile>${JSON.stringify(promptProfile(args.profile))}</master_profile>`,
    `<job_spec>${JSON.stringify({ title: args.spec.title, keywords: args.spec.keywords.map((k) => k.term) })}</job_spec>`,
    `<matched>${JSON.stringify(args.matched.map((m) => ({ term: m.term, proofIds: m.proofIds })))}</matched>`,
    `<gaps>${JSON.stringify(args.gaps.map((g) => g.term))}</gaps>`,
    `<current_cv>${JSON.stringify({ summary: args.resume.summary, experience: args.resume.experience, projects: args.resume.projects })}</current_cv>`,
    `<problems>${JSON.stringify(args.problems)}</problems>`,
  ].join("\n");
  return { system, user };
}
