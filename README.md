# 🎪 Festival Planner

Decide which sets to see at Outside Lands, ACL, and Portola 2026 with your
friends — based on everyone's actual Spotify listening.

## Quick start

1. **Create a Spotify app** at <https://developer.spotify.com/dashboard>:
   - Redirect URI: `http://127.0.0.1:3000/api/auth/callback` (must be exact)
   - API: Web API
   - Under **User Management**, add the Spotify account email of every friend
     who will connect (dev-mode apps only allow listed users).
2. **Configure env:**
   ```bash
   cp .env.example .env.local   # then paste in your client ID + secret
   ```
3. **Run it:**
   ```bash
   npm install
   npm run dev
   ```
   Open <http://127.0.0.1:3000> (use `127.0.0.1`, not `localhost`, so the
   Spotify redirect matches).

## How you'd use it

1. Create a group, share the 6-letter code.
2. Each friend opens the group page, enters their name, and connects Spotify
   (works fine on one shared laptop — the account picker is forced each time).
3. Open a festival to see sets ranked for your group: what to see together,
   where to split up, and what to skip.

As festivals release daily lineups and set times, update the JSON files in
`data/festivals/` (format documented in [CLAUDE.md](CLAUDE.md)) and conflict
detection + break planning light up automatically.
