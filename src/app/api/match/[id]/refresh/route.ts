/**
 * On-demand match refresh endpoint
 * Fetches lineups, refreshes sentiment, and regenerates analysis when user views match detail
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getFixture,
  getLineups,
  setLineups,
  setSentiment,
  setAnalysis,
  setPrediction,
} from "@/lib/kv";
import {
  fetchLineups,
  fetchSentimentForFixture,
  generateAnalysis,
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

    // ALWAYS re-fetch sentiment from Polymarket when user clicks refresh
    console.log(`[Refresh] Fetching sentiment for ${fixtureId}`);
    let sentiment: MarketSentiment | null = await fetchSentimentForFixture(
      fixtureId,
      fixture.homeTeam.name,
      fixture.awayTeam.name,
      fixture.leagueCode,
      fixture.kickoff
    );
    await setSentiment(sentiment);
    sentimentUpdated = sentiment.available;
    console.log(`[Refresh] Sentiment available: ${sentiment.available}, markets: ${sentiment.markets.length}`);

    // ALWAYS regenerate analysis and prediction when user explicitly refreshes
    console.log(`[Refresh] Regenerating analysis for ${fixtureId}`);

    const newAnalysis = await generateAnalysis(fixture, sentiment, lineups);
    await setAnalysis(newAnalysis);

    const newPrediction = generatePrediction(fixture, sentiment, newAnalysis);
    await setPrediction(newPrediction);

    analysisUpdated = true;
    console.log(`[Refresh] Generated prediction: category=${newPrediction.category}, market=${newPrediction.primaryMarket?.type}`)

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
