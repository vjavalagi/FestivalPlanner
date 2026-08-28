import { MemberSnapshot, SpotifyArtistRef, TermKey } from "./types";

const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES =
  "user-top-read user-follow-read user-library-read playlist-read-private user-read-recently-played";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in your Spotify app credentials.`
    );
  }
  return value;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("SPOTIFY_CLIENT_ID"),
    response_type: "code",
    redirect_uri: env("SPOTIFY_REDIRECT_URI"),
    scope: SPOTIFY_SCOPES,
    state,
    // Force the account picker so several friends can connect from one laptop
    show_dialog: "true",
  });
  return `${ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const basic = Buffer.from(
    `${env("SPOTIFY_CLIENT_ID")}:${env("SPOTIFY_CLIENT_SECRET")}`
  ).toString("base64");
  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env("SPOTIFY_REDIRECT_URI"),
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface RawArtist {
  id: string;
  name: string;
  genres?: string[];
}

async function fetchTopArtists(token: string, term: TermKey): Promise<SpotifyArtistRef[]> {
  // Two pages = up to 100 artists per time range, the most Spotify exposes
  const items: RawArtist[] = [];
  for (const offset of [0, 50]) {
    const json = await apiGet<{ items: RawArtist[] }>(
      token,
      `/me/top/artists?time_range=${term}&limit=50&offset=${offset}`
    );
    items.push(...json.items);
    if (json.items.length < 50) break;
  }
  return items.map((a, i) => ({
    id: a.id,
    name: a.name,
    genres: a.genres ?? [],
    rank: i + 1,
  }));
}

async function fetchFollowedArtists(token: string): Promise<{ id: string; name: string }[]> {
  const artists: { id: string; name: string }[] = [];
  let after: string | undefined;
  for (let page = 0; page < 4; page++) {
    const query = after ? `&after=${after}` : "";
    const json = await apiGet<{
      artists: { items: RawArtist[]; cursors?: { after?: string } };
    }>(token, `/me/following?type=artist&limit=50${query}`);
    artists.push(...json.artists.items.map((a) => ({ id: a.id, name: a.name })));
    after = json.artists.cursors?.after ?? undefined;
    if (!after) break;
  }
  return artists;
}

/** Scan the most recent 1000 Liked Songs and count tracks per credited artist. */
async function fetchSavedTrackArtists(
  token: string
): Promise<{ id: string; name: string; count: number }[]> {
  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (let offset = 0; offset < 1000; offset += 50) {
    const json = await apiGet<{
      items: { track: { artists: RawArtist[] } | null }[];
      next: string | null;
    }>(token, `/me/tracks?limit=50&offset=${offset}`);
    for (const item of json.items) {
      for (const artist of item.track?.artists ?? []) {
        const entry = counts.get(artist.id) ?? { id: artist.id, name: artist.name, count: 0 };
        entry.count++;
        counts.set(artist.id, entry);
      }
    }
    if (!json.next) break;
  }
  return [...counts.values()];
}

interface ArtistCount {
  id: string;
  name: string;
  count: number;
}

function tally(counts: Map<string, ArtistCount>, artists: RawArtist[]) {
  for (const artist of artists) {
    // Local files have no Spotify id — fall back to the name as key
    const key = artist.id ?? artist.name;
    const entry = counts.get(key) ?? { id: key, name: artist.name, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
}

/**
 * Scan playlists the member created themself (not followed editorial ones,
 * which would pollute scores) and count tracks per credited artist.
 */
async function fetchPlaylistArtists(token: string, userId: string): Promise<ArtistCount[]> {
  const playlists: { id: string; owner: { id: string } }[] = [];
  for (const offset of [0, 50]) {
    const json = await apiGet<{
      items: { id: string; owner: { id: string } }[];
      next: string | null;
    }>(token, `/me/playlists?limit=50&offset=${offset}`);
    playlists.push(...json.items);
    if (!json.next) break;
  }

  const counts = new Map<string, ArtistCount>();
  let scanned = 0;
  const MAX_TRACKS = 3000; // keep sync time reasonable for playlist hoarders
  for (const playlist of playlists) {
    if (playlist.owner.id !== userId) continue;
    // Spotify 403s some auto-generated playlists (Blends, Wrapped, On Repeat)
    // even though they appear in /me/playlists — skip those, don't fail the sync
    try {
      for (let offset = 0; scanned < MAX_TRACKS; offset += 100) {
        const json = await apiGet<{
          items: { track: { artists: RawArtist[] } | null }[];
          next: string | null;
        }>(
          token,
          `/playlists/${playlist.id}/tracks?limit=100&offset=${offset}&fields=items(track(artists(id,name))),next`
        );
        for (const item of json.items) tally(counts, item.track?.artists ?? []);
        scanned += json.items.length;
        if (!json.next) break;
      }
    } catch {
      continue;
    }
    if (scanned >= MAX_TRACKS) break;
  }
  return [...counts.values()];
}

/** The member's last 50 plays — real listening, even if they never save anything. */
async function fetchRecentArtists(token: string): Promise<ArtistCount[]> {
  const json = await apiGet<{
    items: { track: { artists: RawArtist[] } | null }[];
  }>(token, `/me/player/recently-played?limit=50`);
  const counts = new Map<string, ArtistCount>();
  for (const item of json.items) tally(counts, item.track?.artists ?? []);
  return [...counts.values()];
}

/** Pull everything we need in one shot; we never store the token. */
export async function buildSnapshot(token: string): Promise<MemberSnapshot> {
  const me = await apiGet<{ display_name?: string; id: string }>(token, "/me");
  // Library/recent signals are nice-to-have — if Spotify denies one (dev-mode
  // apps hit random 403s), sync with what we can get instead of failing
  const optional = <T>(promise: Promise<T[]>) => promise.catch(() => [] as T[]);
  const [shortTerm, mediumTerm, longTerm, followed, saved, playlist, recent] =
    await Promise.all([
      fetchTopArtists(token, "short_term"),
      fetchTopArtists(token, "medium_term"),
      fetchTopArtists(token, "long_term"),
      fetchFollowedArtists(token),
      optional(fetchSavedTrackArtists(token)),
      optional(fetchPlaylistArtists(token, me.id)),
      optional(fetchRecentArtists(token)),
    ]);
  return {
    spotifyDisplayName: me.display_name || me.id,
    syncedAt: new Date().toISOString(),
    topArtists: {
      short_term: shortTerm,
      medium_term: mediumTerm,
      long_term: longTerm,
    },
    followedArtists: followed,
    savedTrackArtists: saved,
    playlistArtists: playlist,
    recentArtists: recent,
  };
}
