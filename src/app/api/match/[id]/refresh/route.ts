/**
 * On-demand match refresh endpoint
 * Fetches lineups and refreshes sentiment when user views match detail
 */

import { NextRequest, NextResponse } from "next/server";
import { getFixture, getLineups, getSentiment, setLineups, setSentiment } from "@/lib/kv";
import { fetchLineups, refreshSentimentPrices } from "@/services";
import { minutesUntilKickoff } from "@/lib/date";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fixtureId = parseInt(id, 10);

  if (isNaN(fixtureId)) {
    return NextResponse.json({ error: "Invalid fixture ID" }, { status: 400 });
  }

  try {
    const fixture = await getFixture(fixtureId);
    if (!fixture) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }

    const minsUntil = minutesUntilKickoff(fixture.kickoff);
    let lineupsUpdated = false;
    let sentimentUpdated = false;

    // Fetch lineups if within 55 minutes of kickoff and not already available
    if (minsUntil <= 55 && minsUntil > 0) {
      const existingLineups = await getLineups(fixtureId);

      if (!existingLineups?.available) {
        const lineups = await fetchLineups(fixtureId);
        await setLineups(lineups);
        lineupsUpdated = lineups.available;
      }
    }

    // Refresh sentiment prices
    const sentiment = await getSentiment(fixtureId);
    if (sentiment?.available) {
      const refreshed = await refreshSentimentPrices(sentiment);
      await setSentiment(refreshed);
      sentimentUpdated = true;
    }

    return NextResponse.json({
      success: true,
      fixtureId,
      lineupsUpdated,
      sentimentUpdated,
    });
  } catch (error) {
    console.error("Refresh failed:", error);
    return NextResponse.json(
      { error: "Refresh failed" },
      { status: 500 }
    );
  }
}
