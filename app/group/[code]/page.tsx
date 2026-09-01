import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroup } from "@/lib/db";
import { getFestivals, PHASE_LABELS } from "@/lib/festivals";
import { syncedMembers } from "@/lib/matching";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; synced?: string }>;
}) {
  const { code } = await params;
  const { error, synced } = await searchParams;
  const group = getGroup(code);
  if (!group) notFound();

  const festivals = getFestivals();
  const ready = syncedMembers(group).length;

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <p className="text-sm text-zinc-500">
          Group code:{" "}
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-emerald-400">
            {group.code}
          </span>{" "}
          — share it with your friends
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">{group.name}</h1>
      </section>

      {synced && (
        <p className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
          ✓ {synced}&apos;s Spotify is connected. Scores update automatically.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Who&apos;s in ({group.members.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <span
              key={m.name}
              className={`rounded-full border px-3 py-1 text-sm ${
                m.snapshot
                  ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
              }`}
            >
              {m.name} {m.snapshot ? "✓" : "(not synced)"}
            </span>
          ))}
          {group.members.length === 0 && (
            <p className="text-sm text-zinc-500">
              Nobody has connected Spotify yet. Be the first!
            </p>
          )}
        </div>

        <form
          action="/api/auth/login"
          method="GET"
          className="flex max-w-md flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row"
        >
          <input type="hidden" name="group" value={group.code} />
          <input
            name="name"
            required
            placeholder="Your name"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">
            Connect Spotify
          </button>
        </form>
        <p className="text-xs text-zinc-600">
          We take a one-time snapshot of your top &amp; followed artists — no tokens are
          stored. Reconnect any time to refresh. Use the same name to update your data.
          Sharing this browser with a friend who already connected? Log out at{" "}
          <span className="text-zinc-500">open.spotify.com</span> first (or use a
          private/incognito window) so we grab your account, not theirs.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Festivals
        </h2>
        {ready === 0 && (
          <p className="text-sm text-amber-400">
            Connect at least one Spotify account to see recommendations.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {festivals.map((f) => (
            <Link
              key={f.id}
              href={`/group/${group.code}/${f.id}`}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-emerald-600"
            >
              <h3 className="font-semibold group-hover:text-emerald-400">{f.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{f.dates}</p>
              <p className="text-sm text-zinc-500">{f.location}</p>
              <p className="mt-3 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {PHASE_LABELS[f.phase]}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
