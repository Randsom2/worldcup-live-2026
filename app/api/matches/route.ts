import { NextRequest, NextResponse } from "next/server";
import { getMatches, resolveView } from "@/lib/match-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const view = resolveView(request.nextUrl.searchParams.get("view"));
  const payload = await getMatches(view);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control":
        view === "live"
          ? "s-maxage=25, stale-while-revalidate=20"
          : "s-maxage=300, stale-while-revalidate=300",
    },
  });
}
