import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/spotify";

export function GET(request: NextRequest) {
  const group = request.nextUrl.searchParams.get("group");
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!group || !name) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const state = Buffer.from(JSON.stringify({ group, name })).toString("base64url");
  try {
    return NextResponse.redirect(buildAuthorizeUrl(state));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Spotify is not configured";
    return NextResponse.redirect(
      new URL(`/group/${group}?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
