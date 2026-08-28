# Festival Planner

A web app that helps a group of friends decide which sets to see at music
festivals, based on each person's Spotify listening. Covers **Outside Lands
2026** (Aug 7–9), **Portola 2026** (Sep 26–27), and **Austin City Limits 2026**
(Oct 2–4 & 9–11). Real announced lineups are seeded in `data/festivals/`.

## The plan

1. **Friends form a group.** One person creates a group and gets a 6-letter
   code; everyone else joins with it.
2. **Everyone connects Spotify.** Each member OAuths once; we snapshot their
   top artists (last month / 6 months / all time) and followed artists. No
   tokens are stored — reconnect with the same name to refresh.
3. **The app scores every lineup artist for the group** and sorts sets into
   tiers: *Must-see together*, *Worth seeing*, *Split up* (one superfan),
   *Toss-up*, and *Skip / break time*.
4. **Lineups evolve in three phases**, and the app adapts to whatever data
   exists:
   - **Phase 1** — artist names only → ranked list for the whole festival.
   - **Phase 2** — day assignments → per-day filtering (current state for all
     three 2026 festivals).
   - **Phase 3** — stage + set times → conflict detection ("X overlaps Y,
     group pick is X") and suggested break windows (45+ min gaps with nothing
     the group cares about).

## Commands

```bash
npm run dev     # dev server at http://127.0.0.1:3000 (use 127.0.0.1, not localhost — Spotify requires it)
npm run build   # production build / typecheck
```

Setup: copy `.env.example` to `.env.local` and fill in credentials from a
Spotify app (https://developer.spotify.com/dashboard) whose redirect URI is
exactly `http://127.0.0.1:3000/api/auth/callback`.

**Spotify dev-mode caveat:** apps start in Development Mode, where only users
explicitly added under *User Management* in the dashboard can OAuth. Add each
friend's Spotify account email there before they connect.

## Architecture

- **Next.js 15 App Router + TypeScript + Tailwind.** Server components
  everywhere; the only mutations are two server actions (create/join group)
  and the OAuth routes.
- **Storage is a flat JSON file** at `data/db.json` (gitignored), managed by
  [lib/db.ts](lib/db.ts). Fine for a friends-scale app; swap for SQLite/Postgres
  if this ever gets deployed for many groups.
- [lib/spotify.ts](lib/spotify.ts) — OAuth (authorization-code flow) and a
  one-shot `buildSnapshot` that pulls top artists ×3 time ranges + followed
  artists + Liked Songs + own-playlist tracks + recently played. Scopes:
  `user-top-read user-follow-read user-library-read playlist-read-private
  user-read-recently-played`.
- [lib/matching.ts](lib/matching.ts) — the scoring engine (see below), plus
  phase-3 helpers `findConflicts` and `findBreakWindows`.
- [lib/festivals.ts](lib/festivals.ts) — loads lineup JSON from
  `data/festivals/`.
- Routes: `/` (create/join), `/group/[code]` (members + Spotify connect),
  `/group/[code]/[festivalId]` (recommendations),
  `/api/auth/login` + `/api/auth/callback` (OAuth).

## Scoring model

Per member, each Spotify artist gets 0–100 affinity, rank-weighted within each
list (up to 100 artists per time range): long_term (all-time) worth up to 36
pts, medium_term 32, short_term 24, following +8 — all-time listening is the
strongest signal. Library signals — Liked Songs (most recent 1000) merged
with tracks from playlists the member created (up to 3000, own playlists
only so editorial ones don't pollute) — add 5 pts for one track +3 per
additional, capped at 25. The last 50 plays add 4 pts +2 per repeat, capped
at 15. Together these catch artists someone genuinely plays but who don't
crack their top-100, even for people who never like or playlist anything. Lineup names are matched by normalized name (lowercase, strip
accents/punctuation/leading "the"); "A b2b B" entries match either half.

Per lineup artist, the **group score** = `0.75 × avg(member scores) + 0.25 ×
(fans / members × 100)` where a "fan" scores ≥ 5 — so one superfan can't drag
the whole group. Tiers: ≥55 must-see, ≥30 worth seeing, else "split up" when
one member is ≥55 but at most half the group are fans, ≥12 toss-up, else skip.
Tuning knobs are the constants at the top of [lib/matching.ts](lib/matching.ts).

## Updating lineups as phases drop

Edit the festival's JSON in `data/festivals/` — no code changes needed:

- **New artists announced:** append `{ "name": "Artist" }`.
- **Daily lineups (phase 2):** set `"day"` to one of the festival's `days`
  labels (must match exactly).
- **Set times (phase 3):** add `"stage"`, `"start"`, `"end"` in 24h `"HH:MM"`
  (times before 06:00 are treated as after midnight). Bump `"phase"` to 3.
  Conflicts and break suggestions then appear automatically on day views.

Current data status (checked July 2026): all three festivals are phase 2.
Outside Lands and ACL lists are partial (headliners + notable names by day;
undercard partially unassigned). Portola has the complete A–Z lineup with day
assignments for the bigger names. ACL treats both weekends as one lineup with
weekend-only artists flagged in `note`.

## Known limitations / roadmap

- Name matching misses artists whose Spotify name differs from the poster name
  (e.g. "GRIZTRONICS" won't match Subtronics/GRiZ listeners — consider alias
  support in the JSON: `"aliases": ["Subtronics", "GRiZ"]`).
- No genre-based discovery scoring yet (snapshots already store genres per top
  artist, so "your group would probably like this unknown-to-you artist" is
  buildable from existing data).
- No auth on groups — anyone with a code can view. Fine for friends, not for
  public deployment.
- Possible next features: exportable day schedule (ICS / shareable image),
  per-member "veto/lock" overrides on sets, weekend picker for ACL.
