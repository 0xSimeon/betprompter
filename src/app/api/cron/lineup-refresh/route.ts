/**
 * Lineup Refresh Cron Job
 * Schedule: Every 15 minutes between 06:00-23:00 GMT+1
 *
 * Checks for fixtures 50-55 minutes before kickoff and:
 * 1. Fetches lineups
 * 2. Regenerates AI analysis if material change
 * 3. Refreshes sentiment
 * 4. Updates predictions
 */

import { NextRequest, NextResponse } from "next/server";
import { getTodayGMT1, nowGMT1, minutesUntilKickoff } from "@/lib/date";
import {
  getSelectedFixtures,
  getFixture,
  getSentiment,
  getAnalysis,
  setLineups,
  setAnalysis,
  setSentiment,
  setPrediction,
  setJobLastRun,
} from "@/lib/kv";
import {
  fetchLineups,
  refreshSentimentPrices,
  generateAnalysis,
  shouldRegenerateAnalysis,
  generateEnginePrediction,
} from "@/services";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayGMT1();
  console.log(`[Lineup Refresh] Starting job for ${today}`);

  try {
    // Get selected fixtures for today
    const selectedIds = await getSelectedFixtures(today);

    if (!selectedIds || selectedIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No selected fixtures today",
        refreshed: 0,
      });
    }

    let refreshed = 0;

    for (const fixtureId of selectedIds) {
      const fixture = await getFixture(fixtureId);
      if (!fixture) continue;

      // Check if in refresh window (50-60 minutes before kickoff)
      const minsUntil = minutesUntilKickoff(fixture.kickoff);

      if (minsUntil < 50 || minsUntil > 60) {
        continue;
      }

      console.log(
        `[Lineup Refresh] Processing ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName} (${minsUntil} min to kickoff)`
      );

      // Fetch lineups
      const lineups = await fetchLineups(fixtureId);
      await setLineups(lineups);

      // Refresh sentiment
      let sentiment = await getSentiment(fixtureId);
      if (sentiment) {
        sentiment = await refreshSentimentPrices(sentiment);
        await setSentiment(sentiment);
      }

      // Check if we need to regenerate analysis
      const existingAnalysis = await getAnalysis(fixtureId);

      if (shouldRegenerateAnalysis(existingAnalysis, fixture, sentiment, lineups)) {
        console.log(`[Lineup Refresh] Regenerating analysis for ${fixtureId}`);

        const newAnalysis = await generateAnalysis(fixture, sentiment, lineups);
        await setAnalysis(newAnalysis);

        const newPrediction = generateEnginePrediction(fixture, sentiment, newAnalysis);
        await setPrediction(newPrediction);
      }

      refreshed++;
    }

    await setJobLastRun("lineup-refresh", nowGMT1());

    const result = {
      success: true,
      date: today,
      refreshed,
    };

    console.log("[Lineup Refresh] Job completed:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Lineup Refresh] Job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
