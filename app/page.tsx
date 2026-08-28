import { redirect } from "next/navigation";
import { createGroup, getGroup } from "@/lib/db";
import { getFestivals } from "@/lib/festivals";

async function createGroupAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "");
  const group = createGroup(name);
  redirect(`/group/${group.code}`);
}

async function joinGroupAction(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (getGroup(code)) redirect(`/group/${code}`);
  redirect(`/?error=${encodeURIComponent(`No group found with code ${code}`)}`);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const festivals = getFestivals();

  return (
    <div className="space-y-12">
      <section className="space-y-3 pt-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Pick your festival sets, <span className="text-emerald-400">together</span>.
        </h1>
        <p className="mx-auto max-w-2xl text-zinc-400">
          Everyone connects Spotify. We match your group&apos;s listening against the
          lineups for Outside Lands, ACL, and Portola 2026 — then tell you which sets
          to see together, when to split up, and when to take a break.
        </p>
      </section>

      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <form
          action={createGroupAction}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h2 className="text-lg font-semibold">Start a group</h2>
          <input
            name="name"
            placeholder="Group name (e.g. Portola Crew)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">
            Create group
          </button>
        </form>

        <form
          action={joinGroupAction}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h2 className="text-lg font-semibold">Join a group</h2>
          <input
            name="code"
            required
            placeholder="6-letter group code"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-emerald-500"
          />
          <button className="w-full rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold hover:border-zinc-400">
            Join group
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Festivals covered
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {festivals.map((f) => (
            <div key={f.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="font-semibold">{f.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{f.location}</p>
              <p className="text-sm text-zinc-400">{f.dates}</p>
              <p className="mt-2 text-xs text-zinc-500">{f.artists.length} artists loaded</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
