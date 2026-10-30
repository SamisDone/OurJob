import type { Metadata } from "next";
import Link from "next/link";
import { Nums } from "@/components/nums";
import { NeedsProfile } from "@/components/shell/page-states";
import { TailorWorkspace } from "@/components/tailor/tailor-workspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { currentProfileStatus } from "@/lib/profile/status";
import { listTailorings } from "@/lib/tailor/service";

export const metadata: Metadata = { title: "Tailor" };

const DESCRIPTION = "Paste a job post and get your CV rewritten for it, ready to open in Overleaf.";

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile title="Tailor" description={DESCRIPTION} status={status}>
        A tailored CV only uses facts from your confirmed profile, so tailoring starts once you confirm it.
      </NeedsProfile>
    );
  }
  const user = await requireUser();
  const recent = await listTailorings(user.id, 8);
  return (
    <TailorWorkspace
      recent={
        recent.length > 0 && (
          <Card className="mt-8 max-w-3xl">
            <CardHeader>
              <CardTitle>
                <h2>Recent</h2>
              </CardTitle>
              <CardDescription>
                CVs you tailored before. Open one to see it again or send it to Overleaf.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tailor/${t.id}`}
                      className="flex items-center gap-3 py-3 outline-none hover:underline focus-visible:underline"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{t.title}</span>
                        {t.company && <span className="text-muted-foreground"> at {t.company}</span>}
                      </span>
                      {t.score !== null && (
                        <Badge variant="secondary">
                          <Nums>{`${t.score} ATS`}</Nums>
                        </Badge>
                      )}
                      <time dateTime={t.createdAt} className="text-sm text-muted-foreground">
                        <Nums>{day.format(new Date(t.createdAt))}</Nums>
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      }
    />
  );
}
