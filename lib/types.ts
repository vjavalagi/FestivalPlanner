export type TermKey = "short_term" | "medium_term" | "long_term";

export interface SpotifyArtistRef {
  id: string;
  name: string;
  genres: string[];
  /** 1-based rank within its time-range list */
  rank: number;
}

export interface MemberSnapshot {
  spotifyDisplayName: string;
  syncedAt: string;
  topArtists: Record<TermKey, SpotifyArtistRef[]>;
  followedArtists: { id: string; name: string }[];
  /** Artists appearing in the member's Liked Songs, with track counts */
  savedTrackArtists?: { id: string; name: string; count: number }[];
  /** Artists appearing in playlists the member created, with track counts */
  playlistArtists?: { id: string; name: string; count: number }[];
  /** Artists in the member's last 50 plays, with play counts */
  recentArtists?: { id: string; name: string; count: number }[];
}

export interface Member {
  /** Name the friend entered when joining the group */
  name: string;
  snapshot?: MemberSnapshot;
}

export interface Group {
  code: string;
  name: string;
  createdAt: string;
  members: Member[];
}

export interface Database {
  groups: Record<string, Group>;
}

/**
 * Lineup data supports the three announcement phases:
 *  Phase 1: names only. Phase 2: `day` filled in. Phase 3: `stage`/`start`/`end` filled in.
 */
export interface LineupArtist {
  name: string;
  day?: string;
  stage?: string;
  /** 24h local time, e.g. "14:40" */
  start?: string;
  end?: string;
  note?: string;
}

export interface Festival {
  id: string;
  name: string;
  location: string;
  dates: string;
  /** ISO date used only for ordering festival cards */
  startDate: string;
  phase: 1 | 2 | 3;
  /** Ordered day labels, e.g. ["Friday, Aug 7", ...] */
  days: string[];
  lineupNote?: string;
  artists: LineupArtist[];
}
