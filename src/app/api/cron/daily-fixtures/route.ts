/**
 * Daily Fixtures Cron Job
 * Schedule: 05:00 GMT+1 daily (04:00 UTC)
 *
 * 1. Fetch fixtures for today
 * 2. Filter to selected fixtures
 * 3. Fetch sentiment for each
 * 4. Generate AI analysis
 * 5. Generate predictions
 * 6. Store all in KV
 */

import { NextRequest, NextResponse } from "next/server";
import { getTodayGMT1, nowGMT1 } from "@/lib/date";
import {
  setDailyFixtures,
  setFixture,
  setSelectedFixtures,
  setSentiment,
  setAnalysis,
  setPrediction,
  setJobLastRun,
} from "@/lib/kv";
import {
  fetchFixturesByDate,
  fetchSentimentForFixture,
  generateAnalysis,
  filterSelectedFixtures,
  generatePrediction,
} from "@/services";
import type { MarketSentiment } from "@/types";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayGMT1();
  console.log(`[Daily Fixtures] Starting job for ${today}`);

  try {
    // Step 1: Fetch all fixtures
    console.log("[Daily Fixtures] Fetching fixtures from Football-Data.org...");
    const fixtures = await fetchFixturesByDate(today);
    console.log(`[Daily Fixtures] Found ${fixtures.length} fixtures`);

    if (fixtures.length === 0) {
      await setJobLastRun("daily-fixtures", nowGMT1());
      return NextResponse.json({
        success: true,
        date: today,
        total: 0,
        selected: 0,
        message: "No fixtures today",
      });
    }

    // Store all fixtures
    await setDailyFixtures(today, fixtures);
    for (const fixture of fixtures) {
      await setFixture(fixture);
    }

    // Step 2: Fetch sentiment for each fixture
    console.log("[Daily Fixtures] Fetching sentiment from Polymarket...");
    const sentimentMap = new Map<number, MarketSentiment>();

    for (const fixture of fixtures) {
      const sentiment = await fetchSentimentForFixture(
        fixture.id,
        fixture.homeTeam.name,
        fixture.awayTeam.name,
        fixture.leagueCode,
        fixture.kickoff
      );
      sentimentMap.set(fixture.id, sentiment);
      await setSentiment(sentiment);
    }

    // Step 3: Filter to selected fixtures
    console.log("[Daily Fixtures] Filtering selected fixtures...");
    const selectedFixtures = filterSelectedFixtures(fixtures, sentimentMap);
    console.log(`[Daily Fixtures] Selected ${selectedFixtures.length} fixtures`);

    // Store selected fixture IDs
    await setSelectedFixtures(
      today,
      selectedFixtures.map((f) => f.id)
    );

    // Step 4 & 5: Generate AI analysis and predictions for selected fixtures
    console.log("[Daily Fixtures] Generating AI analysis...");

    for (const fixture of selectedFixtures) {
      const sentiment = sentimentMap.get(fixture.id) || null;

      // Generate AI analysis (no lineups yet at daily job time)
      const analysis = await generateAnalysis(fixture, sentiment, null);
      await setAnalysis(analysis);

      // Generate prediction
      const prediction = generatePrediction(fixture, sentiment, analysis);
      await setPrediction(prediction);

      console.log(
        `[Daily Fixtures] ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${prediction.category}`
      );
    }

    // Mark job as complete
    await setJobLastRun("daily-fixtures", nowGMT1());

    const result = {
      success: true,
      date: today,
      total: fixtures.length,
      selected: selectedFixtures.length,
      byCategory: {
        banker: selectedFixtures.filter(
          (f) => sentimentMap.get(f.id)?.available
        ).length,
      },
    };

    console.log("[Daily Fixtures] Job completed:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Daily Fixtures] Job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
