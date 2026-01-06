/**
 * On-demand match refresh endpoint
 * Fetches lineups, refreshes sentiment, and regenerates analysis when user views match detail
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getFixture,
  getLineups,
  getSentiment,
  getAnalysis,
  setLineups,
  setSentiment,
  setAnalysis,
  setPrediction,
} from "@/lib/kv";
import {
  fetchLineups,
  fetchSentimentForFixture,
  refreshSentimentPrices,
  generateAnalysis,
  shouldRegenerateAnalysis,
  generatePrediction,
} from "@/services";
import { minutesUntilKickoff } from "@/lib/date";
import type { Lineups, MarketSentiment } from "@/types";

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
    let analysisUpdated = false;
    let lineups: Lineups | null = null;

    // Fetch lineups if within 55 minutes of kickoff and not already available
    if (minsUntil <= 55 && minsUntil > 0) {
      const existingLineups = await getLineups(fixtureId);

      if (!existingLineups?.available) {
        lineups = await fetchLineups(fixtureId);
        await setLineups(lineups);
        lineupsUpdated = lineups.available;
      } else {
        lineups = existingLineups;
      }
    } else {
      lineups = await getLineups(fixtureId);
    }

    // Fetch or refresh sentiment
    let sentiment: MarketSentiment | null = await getSentiment(fixtureId);
    if (sentiment?.available) {
      // Refresh existing sentiment prices
      sentiment = await refreshSentimentPrices(sentiment);
      await setSentiment(sentiment);
      sentimentUpdated = true;
    } else {
      // Fetch new sentiment if not available
      console.log(`[Refresh] Fetching sentiment for ${fixtureId}`);
      sentiment = await fetchSentimentForFixture(
        fixtureId,
        fixture.homeTeam.name,
        fixture.awayTeam.name,
        fixture.leagueCode,
        fixture.kickoff
      );
      await setSentiment(sentiment);
      sentimentUpdated = sentiment.available;
    }

    // Regenerate analysis if lineups or sentiment changed
    const existingAnalysis = await getAnalysis(fixtureId);
    const shouldRegenerate = shouldRegenerateAnalysis(existingAnalysis, fixture, sentiment, lineups);

    if (shouldRegenerate || (sentimentUpdated && sentiment?.available)) {
      const reason = lineupsUpdated ? "with lineups" : sentimentUpdated ? "with sentiment" : "inputs changed";
      console.log(`[Refresh] Regenerating analysis for ${fixtureId} ${reason}`);

      const newAnalysis = await generateAnalysis(fixture, sentiment, lineups);
      await setAnalysis(newAnalysis);

      const newPrediction = generatePrediction(fixture, sentiment, newAnalysis);
      await setPrediction(newPrediction);

      analysisUpdated = true;
    }

    return NextResponse.json({
      success: true,
      fixtureId,
      lineupsUpdated,
      sentimentUpdated,
      analysisUpdated,
      lineupsAvailable: lineups?.available ?? false,
    });
  } catch (error) {
    console.error("Refresh failed:", error);
    return NextResponse.json(
      { error: "Refresh failed" },
      { status: 500 }
    );
  }
}
