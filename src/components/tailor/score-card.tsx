import { ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export type ScorePart = { id: string; label: string; points: number; max: number; detail: string };

/**
 * The estimated ATS score: the number against the master CV, a progress bar
 * for each part of the score, and the matched and missing keywords.
 */
export function ScoreCard({
  score,
  master,
  parts,
  matched,
  missing,
}: {
  score: number;
  master: number;
  parts: ScorePart[];
  matched: string[];
  missing: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimated ATS match</CardTitle>
        <CardDescription>An estimate of how a resume screener would rate this CV for the job.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-end gap-3">
            <span className="num text-5xl leading-none font-semibold tracking-tight">{score}</span>
            <span className="pb-1 text-muted-foreground">out of 100</span>
            {score > master && (
              <Badge variant="success" className="mb-1.5">
                <ArrowUp data-icon="inline-start" aria-hidden />
                <span className="sr-only">up </span>
                <span className="num">{score - master}</span>
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Your full CV, with everything in your profile, scores <span className="num">{master}</span> for this job.{" "}
            {score === master
              ? "Tailoring cannot add keywords you do not have, and your full CV already has every one this job asks for that your profile proves. It gains only by moving keywords into bullets and matching the job title; here those were already in place."
              : score < master
                ? "This one-page version leaves out some lines that mention the job's keywords; your full CV keeps them all."
                : "Tailoring moved the job's keywords into your bullets and matched the job title."}
          </p>
        </div>

        <ul className="space-y-4" aria-label="Score breakdown">
          {parts.map((p) => (
            <li key={p.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="num text-muted-foreground">
                  {formatPoints(p.points)} / {p.max}
                </span>
              </div>
              <Progress
                value={(p.points / p.max) * 100}
                aria-label={`${p.label}, ${formatPoints(p.points)} of ${p.max}`}
              />
              <p className="text-sm text-muted-foreground">{p.detail}</p>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            Matched <span className="num text-muted-foreground">{matched.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-1.5" aria-label="Matched keywords">
            {matched.map((k) => (
              <li key={k}>
                <Badge variant="success">{k}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            Missing <span className="num text-muted-foreground">{missing.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-1.5" aria-label="Missing keywords">
            {missing.map((k) => (
              <li key={k}>
                <Badge variant="destructive">{k}</Badge>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Missing words stay out of your CV unless your profile shows you have them.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
