import { NextRequest, NextResponse } from "next/server";
import { saveMemberSnapshot } from "@/lib/db";
import { buildSnapshot, exchangeCodeForToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stateRaw = params.get("state");

  let group = "";
  let name = "";
  try {
    const state = JSON.parse(Buffer.from(stateRaw ?? "", "base64url").toString("utf8"));
    group = String(state.group ?? "");
    name = String(state.name ?? "");
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const groupUrl = new URL(`/group/${group}`, request.url);

  const spotifyError = params.get("error");
  if (spotifyError) {
    groupUrl.searchParams.set("error", `Spotify said: ${spotifyError}`);
    return NextResponse.redirect(groupUrl);
  }

  const code = params.get("code");
  if (!code || !group || !name) {
    groupUrl.searchParams.set("error", "Spotify connection was cancelled.");
    return NextResponse.redirect(groupUrl);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const snapshot = await buildSnapshot(token);
    const saved = saveMemberSnapshot(group, name, snapshot);
    if (!saved) {
      groupUrl.searchParams.set("error", `Group ${group} no longer exists.`);
      return NextResponse.redirect(groupUrl);
    }
    groupUrl.searchParams.set("synced", name);
    return NextResponse.redirect(groupUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync Spotify data.";
    groupUrl.searchParams.set("error", message);
    return NextResponse.redirect(groupUrl);
  }
}
