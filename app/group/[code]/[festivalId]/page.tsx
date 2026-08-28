import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroup } from "@/lib/db";
import { getFestival, PHASE_LABELS } from "@/lib/festivals";
import {
  SetRecommendation,
  Tier,
  TIER_META,
  findBreakWindows,
  findConflicts,
  scoreFestival,
  syncedMembers,
} from "@/lib/matching";

const TIER_ORDER: Tier[] = ["must", "worth", "split", "tossup", "skip"];

const TIER_ACCENT: Record<Tier, string> = {
  must: "border-emerald-600",
  worth: "border-sky-700",
  split: "border-violet-700",
  tossup: "border-zinc-700",
  skip: "border-zinc-800",
};

const TIER_BADGE: Record<Tier, string> = {
  must: "bg-emerald-500 text-zinc-950",
  worth: "bg-sky-600 text-zinc-50",
  split: "bg-violet-600 text-zinc-50",
  tossup: "bg-zinc-700 text-zinc-200",
  skip: "bg-zinc-800 text-zinc-500",
};

function scoreColor(score: number): string {
  if (score >= 55) return "text-emerald-400";
  if (score >= 30) return "text-sky-400";
  if (score >= 12) return "text-zinc-300";
  return "text-zinc-600";
}

function RecCard({ rec }: { rec: SetRecommendation }) {
  const { artist } = rec;
  const when = [artist.day, artist.stage, artist.start && `${artist.start}–${artist.end}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className={`rounded-xl border bg-zinc-900 p-4 ${TIER_ACCENT[rec.tier]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{artist.name}</h4>
          <p className="text-xs text-zinc-500">{when || "Day & time TBA"}</p>
          {artist.note && <p className="text-xs text-zinc-500">{artist.note}</p>}
          {rec.champion && (
            <p className="mt-1 text-xs text-violet-400">{rec.champion}&apos;s pick</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${TIER_BADGE[rec.tier]}`}
        >
          {rec.groupScore}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rec.memberScores.map((ms) => (
          <span
            key={ms.member}
            title={ms.reason ?? (ms.score > 0 ? "in their listening" : "no listening history")}
            className={`rounded bg-zinc-950 px-2 py-0.5 text-xs ${scoreColor(ms.score)}`}
          >
            {ms.member} {ms.score}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function FestivalPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; festivalId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { code, festivalId } = await params;
  const { day } = await searchParams;
  const group = getGroup(code);
  const festival = getFestival(festivalId);
  if (!group || !festival) notFound();

  const members = syncedMembers(group);
  const recs = scoreFestival(festival, group);
  const hasTimes = festival.artists.some((a) => a.start && a.end);

  const selectedDay = day && festival.days.includes(day) ? day : undefined;
  const visible = selectedDay
    ? recs.filter((r) => r.artist.day === selectedDay)
    : recs;
  const tbaCount = recs.filter((r) => !r.artist.day).length;

  const conflicts = selectedDay && hasTimes ? findConflicts(recs, selectedDay) : [];
  const breaks = selectedDay && hasTimes ? findBreakWindows(recs, selectedDay) : [];

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/group/${group.code}`} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← {group.name}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{festival.name}</h1>
        <p className="text-zinc-400">
          {festival.dates} · {festival.location}
        </p>
        <p className="mt-2 inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
          {PHASE_LABELS[festival.phase]}
        </p>
        {festival.lineupNote && (
          <p className="mt-2 text-xs text-zinc-500">{festival.lineupNote}</p>
        )}
      </div>

      {members.length === 0 ? (
        <p className="rounded-lg border border-amber-800 bg-amber-950 px-4 py-3 text-sm text-amber-300">
          Nobody in this group has connected Spotify yet.{" "}
          <Link href={`/group/${group.code}`} className="underline">
            Connect on the group page
          </Link>{" "}
          to see recommendations.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            Scored for {members.map((m) => m.name).join(", ")}. Scores are 0–100 and blend
            average interest with how many of you listen to each artist.
          </p>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/group/${group.code}/${festival.id}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                !selectedDay
                  ? "border-emerald-500 text-emerald-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              All days
            </Link>
            {festival.days.map((d) => (
              <Link
                key={d}
                href={`/group/${group.code}/${festival.id}?day=${encodeURIComponent(d)}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  selectedDay === d
                    ? "border-emerald-500 text-emerald-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {d}
              </Link>
            ))}
          </div>
          {!selectedDay && tbaCount > 0 && (
            <p className="text-xs text-zinc-600">
              {tbaCount} artists don&apos;t have a confirmed day yet — they only show under
              &ldquo;All days&rdquo;.
            </p>
          )}

          {!hasTimes && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-500">
              ⏱ The hour-by-hour schedule hasn&apos;t been released yet. Once set times are
              added to the lineup file, this page will also flag schedule conflicts and
              suggest break windows.
            </p>
          )}

          {conflicts.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400">
                Schedule conflicts
              </h2>
              {conflicts.map((c, i) => (
                <p key={i} className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm">
                  <strong>{c.a.artist.name}</strong> overlaps{" "}
                  <strong>{c.b.artist.name}</strong> — group pick:{" "}
                  <span className="text-emerald-400">{c.pick.artist.name}</span> (score{" "}
                  {c.pick.groupScore})
                </p>
              ))}
            </section>
          )}

          {breaks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                Suggested breaks
              </h2>
              {breaks.map((b, i) => (
                <p key={i} className="rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm">
                  🧘 {b.start} – {b.end} ({b.minutes} min) — nothing your group cares about
                  is on. Eat, rest, explore.
                </p>
              ))}
            </section>
          )}

          {TIER_ORDER.map((tier) => {
            const inTier = visible.filter((r) => r.tier === tier);
            if (inTier.length === 0) return null;
            return (
              <section key={tier} className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold">{TIER_META[tier].label}</h2>
                  <p className="text-sm text-zinc-500">{TIER_META[tier].blurb}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inTier.map((rec) => (
                    <RecCard key={rec.artist.name} rec={rec} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
