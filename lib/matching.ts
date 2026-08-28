import {
  Festival,
  Group,
  LineupArtist,
  Member,
  MemberSnapshot,
  TermKey,
} from "./types";

/**
 * How much each Spotify signal is worth. A #1 artist in every time range who
 * is also followed maxes out at 100.
 */
const TERM_WEIGHTS: Record<TermKey, number> = {
  short_term: 24, // last ~4 weeks — what you're excited about right now
  medium_term: 32, // last ~6 months
  long_term: 36, // all-time (several years) — the strongest signal
};
const FOLLOW_BONUS = 8;

const TERM_LABELS: Record<TermKey, string> = {
  short_term: "top artist this month",
  medium_term: "top artist (6 mo)",
  long_term: "all-time top artist",
};

export type Tier = "must" | "worth" | "split" | "tossup" | "skip";

export const TIER_META: Record<Tier, { label: string; blurb: string }> = {
  must: { label: "Must-see together", blurb: "High scores across the group — plan around these." },
  worth: { label: "Worth seeing", blurb: "Solid group interest. Go if there's no conflict." },
  split: { label: "Split up", blurb: "One or two people love this — split and meet up after." },
  tossup: { label: "Toss-up", blurb: "Mild interest. Good candidates for wandering or food runs." },
  skip: { label: "Skip / break time", blurb: "Nobody's listening — use these windows to rest." },
};

export interface MemberScore {
  member: string;
  score: number;
  reason?: string;
}

export interface SetRecommendation {
  artist: LineupArtist;
  groupScore: number;
  avgScore: number;
  maxScore: number;
  fanCount: number;
  memberScores: MemberScore[];
  tier: Tier;
  /** Member with the highest score, when the set is a "split up" pick */
  champion?: string;
}

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

interface Affinity {
  score: number;
  reason?: string;
}

/** Collapse a member's Spotify snapshot into normalized-artist-name -> affinity. */
export function buildAffinityMap(snapshot: MemberSnapshot): Map<string, Affinity> {
  const map = new Map<string, Affinity>();
  const bump = (name: string, points: number, reason?: string) => {
    const key = normalizeName(name);
    if (!key) return;
    const current = map.get(key) ?? { score: 0 };
    const next: Affinity = {
      score: Math.min(100, current.score + points),
      reason: current.reason ?? reason,
    };
    map.set(key, next);
  };

  for (const term of Object.keys(TERM_WEIGHTS) as TermKey[]) {
    const list = snapshot.topArtists[term] ?? [];
    for (const artist of list) {
      const points = (TERM_WEIGHTS[term] * (list.length - artist.rank + 1)) / list.length;
      const reason =
        artist.rank <= 15 ? `#${artist.rank} ${TERM_LABELS[term]}` : undefined;
      bump(artist.name, points, reason);
    }
  }
  for (const artist of snapshot.followedArtists) {
    bump(artist.name, FOLLOW_BONUS, "follows on Spotify");
  }
  // Library signals catch artists someone genuinely listens to but who don't
  // crack their top-100. Liked Songs and own-playlist tracks are merged so a
  // song that's both liked and playlisted isn't double counted:
  // 5 pts for one track, +3 each additional, cap 25.
  const libraryCounts = new Map<string, number>();
  for (const artist of [
    ...(snapshot.savedTrackArtists ?? []),
    ...(snapshot.playlistArtists ?? []),
  ]) {
    const key = normalizeName(artist.name);
    libraryCounts.set(key, Math.max(libraryCounts.get(key) ?? 0, artist.count));
  }
  for (const artist of [
    ...(snapshot.savedTrackArtists ?? []),
    ...(snapshot.playlistArtists ?? []),
  ]) {
    const count = libraryCounts.get(normalizeName(artist.name));
    if (count === undefined) continue;
    libraryCounts.delete(normalizeName(artist.name));
    const points = Math.min(25, 5 + 3 * (count - 1));
    const label = count === 1 ? "1 track in library" : `${count} tracks in library`;
    bump(artist.name, points, label);
  }
  // Last 50 plays — real listening even for people who never save or playlist
  for (const artist of snapshot.recentArtists ?? []) {
    const points = Math.min(15, 4 + 2 * (artist.count - 1));
    const label = artist.count === 1 ? "played recently" : `${artist.count} recent plays`;
    bump(artist.name, points, label);
  }
  return map;
}

/**
 * Look up a lineup entry in an affinity map. Falls back to splitting
 * back-to-back DJ sets ("A b2b B") and matching either half.
 */
function lookupAffinity(map: Map<string, Affinity>, lineupName: string): Affinity | undefined {
  const direct = map.get(normalizeName(lineupName));
  if (direct) return direct;
  if (/\bb2b\b/i.test(lineupName)) {
    let best: Affinity | undefined;
    for (const part of lineupName.split(/\bb2b\b/i)) {
      const hit = map.get(normalizeName(part));
      if (hit && (!best || hit.score > best.score)) best = hit;
    }
    return best;
  }
  return undefined;
}

function assignTier(
  groupScore: number,
  maxScore: number,
  fanCount: number,
  syncedCount: number
): Tier {
  if (groupScore >= 55) return "must";
  if (groupScore >= 30) return "worth";
  if (maxScore >= 55 && fanCount <= Math.max(1, Math.floor(syncedCount / 2))) return "split";
  if (groupScore >= 12) return "tossup";
  return "skip";
}

export function syncedMembers(group: Group): Member[] {
  return group.members.filter((m) => m.snapshot);
}

export function scoreFestival(festival: Festival, group: Group): SetRecommendation[] {
  const members = syncedMembers(group);
  if (members.length === 0) return [];

  const affinityMaps = members.map((m) => ({
    name: m.name,
    map: buildAffinityMap(m.snapshot!),
  }));

  return festival.artists
    .map((artist) => {
      const memberScores: MemberScore[] = affinityMaps.map(({ name, map }) => {
        const affinity = lookupAffinity(map, artist.name);
        return {
          member: name,
          score: Math.round(affinity?.score ?? 0),
          reason: affinity?.reason,
        };
      });
      const scores = memberScores.map((s) => s.score);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const maxScore = Math.max(...scores);
      const fanCount = scores.filter((s) => s >= 5).length;
      const breadth = fanCount / members.length;
      // Blend average interest with how many friends share it, so one
      // superfan doesn't drag everyone to a set nobody else wants.
      const groupScore = Math.round(0.75 * avgScore + 0.25 * breadth * 100);
      const tier = assignTier(groupScore, maxScore, fanCount, members.length);
      const top = memberScores.reduce((a, b) => (b.score > a.score ? b : a));
      return {
        artist,
        groupScore,
        avgScore: Math.round(avgScore),
        maxScore,
        fanCount,
        memberScores,
        tier,
        champion: tier === "split" ? top.member : undefined,
      };
    })
    .sort((a, b) => b.groupScore - a.groupScore || b.maxScore - a.maxScore);
}

// ---------- Phase 3 helpers (hour-by-hour schedules) ----------

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  // Treat early-morning times as after midnight so late sets sort correctly
  return h < 6 ? (h + 24) * 60 + m : h * 60 + m;
}

export function formatMinutes(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export interface Conflict {
  a: SetRecommendation;
  b: SetRecommendation;
  pick: SetRecommendation;
}

/** Overlapping must-see / worth-seeing sets on the same day. */
export function findConflicts(recs: SetRecommendation[], day: string): Conflict[] {
  const timed = recs
    .filter(
      (r) =>
        r.artist.day === day &&
        r.artist.start &&
        r.artist.end &&
        (r.tier === "must" || r.tier === "worth")
    )
    .sort((a, b) => toMinutes(a.artist.start!) - toMinutes(b.artist.start!));
  const conflicts: Conflict[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (toMinutes(b.artist.start!) < toMinutes(a.artist.end!)) {
        conflicts.push({ a, b, pick: b.groupScore > a.groupScore ? b : a });
      }
    }
  }
  return conflicts;
}

export interface BreakWindow {
  start: string;
  end: string;
  minutes: number;
}

/**
 * Gaps of 45+ minutes between recommended sets on a day — natural times to
 * eat, rest, or hit the merch stand.
 */
export function findBreakWindows(recs: SetRecommendation[], day: string): BreakWindow[] {
  const anchors = recs
    .filter(
      (r) =>
        r.artist.day === day &&
        r.artist.start &&
        r.artist.end &&
        (r.tier === "must" || r.tier === "worth")
    )
    .sort((a, b) => toMinutes(a.artist.start!) - toMinutes(b.artist.start!));
  const windows: BreakWindow[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const gapStart = toMinutes(anchors[i].artist.end!);
    // Next anchor that starts after this one ends
    const laterStarts = anchors
      .slice(i + 1)
      .map((r) => toMinutes(r.artist.start!))
      .filter((s) => s >= gapStart);
    if (laterStarts.length === 0) break;
    const gapEnd = Math.min(...laterStarts);
    if (gapEnd - gapStart >= 45) {
      windows.push({
        start: formatMinutes(gapStart),
        end: formatMinutes(gapEnd),
        minutes: gapEnd - gapStart,
      });
    }
  }
  return windows;
}
