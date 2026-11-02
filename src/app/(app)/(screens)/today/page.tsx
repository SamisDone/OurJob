import type { Metadata } from "next";
import { TodayEmpty, TodayLoadError, TodayView } from "@/components/jobs/today-view";
import { NeedsProfile } from "@/components/shell/page-states";
import { requireUser } from "@/lib/auth/session";
import { getFeed } from "@/lib/jobs/feed";
import { getPreferencesOrDraft, profileDb } from "@/lib/profile/service";
import { currentProfileStatus } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Today" };

export default async function Page() {
  const status = await currentProfileStatus();
  if (status !== "confirmed") {
    return (
      <NeedsProfile
        title="Today"
        description="Fresh remote jobs from the last 7 days, ranked by how well they fit you."
        status={status}
      >
        Jobs are ranked against your confirmed profile, so the daily feed starts once you confirm it.
      </NeedsProfile>
    );
  }
  const user = await requireUser();
  const now = new Date();
  let timeZone = "Asia/Dhaka";
  let feed: Awaited<ReturnType<typeof getFeed>>;
  try {
    const { data: prefs } = await getPreferencesOrDraft(user.id);
    timeZone = prefs.timezone || timeZone;
    feed = await getFeed(profileDb(), user.id, prefs, now);
  } catch (e) {
    console.error("[today] the feed did not load:", e instanceof Error ? e.message : "unknown");
    return <TodayLoadError />;
  }
  if (!feed.run || !feed.jobs.length) return <TodayEmpty run={feed.run} timeZone={timeZone} />;
  return <TodayView jobs={feed.jobs} run={feed.run} now={now} timeZone={timeZone} />;
}
