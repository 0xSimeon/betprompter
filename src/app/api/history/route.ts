import { NextRequest, NextResponse } from "next/server";
import { getMonthlyHistory, getStats } from "@/lib/kv";
import { formatYearMonthGMT1 } from "@/lib/date";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get("month") || formatYearMonthGMT1(new Date());

  try {
    const [outcomes, stats] = await Promise.all([
      getMonthlyHistory(month),
      getStats(),
    ]);

    return NextResponse.json({
      month,
      outcomes: outcomes || [],
      stats,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
