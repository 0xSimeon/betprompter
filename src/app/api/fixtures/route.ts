import { NextRequest, NextResponse } from "next/server";
import { getFixturesWithPredictions, getDailyFixtures } from "@/lib/kv";
import { getTodayGMT1 } from "@/lib/date";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || getTodayGMT1();

  try {
    const [fixtures, allFixtures] = await Promise.all([
      getFixturesWithPredictions(date),
      getDailyFixtures(date),
    ]);

    return NextResponse.json({
      date,
      fixtures: fixtures || [],
      total: allFixtures?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching fixtures:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixtures" },
      { status: 500 }
    );
  }
}
