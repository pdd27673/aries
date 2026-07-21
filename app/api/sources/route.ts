import { NextResponse } from "next/server";
import { listSources } from "@/services/sources.service";

// Read ENABLED_SOURCES at request time, not build time — otherwise Next would
// statically prerender this route and bake in whatever sources were set at build,
// ignoring the env var configured in the deploy dashboard.
export const dynamic = "force-dynamic";

// GET /api/sources — the enabled news sources for the UI's source picker.
export function GET() {
  return NextResponse.json({ sources: listSources() });
}
