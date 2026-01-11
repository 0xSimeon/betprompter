/**
 * Fixtures Ingestion Cron Job
 * Per ENGINE_SPEC: Fetches fixtures for a rolling 2-week window
 *
 * Schedule: Sunday 22:00 GMT+1 (21:00 UTC)
 * Modes:
 *   - default/rolling: 14-day window (today + 13 days)
 *   - current: current week only (Mon-Sun)
 *   - upcoming: next week only (Mon-Sun)
 *
 * 1. Fetch fixtures for each day in the window
 * 2. Fetch Polymarket sentiment for each fixture
 * 3. Generate AI analysis (without lineups)
 * 4. Generate predictions
 * 5. Store all in KV
 */

import { NextRequest, NextResponse } from "next/server";
import { getUpcomingWeekDates, getCurrentWeekDates, getRollingTwoWeekDates, nowGMT1 } from "@/lib/date";
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
  generateEnginePrediction,
  scoreAllMarkets,
  DAILY_BET_CAP,
} from "@/services";
import type { Fixture, MarketSentiment, Prediction } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET || "";

interface DayResult {
  date: string;
  total: number;
  selected: number;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per ENGINE_SPEC: rolling 2-week window is the default
  // Use ?mode=current for current week, ?mode=upcoming for next week
  const mode = request.nextUrl.searchParams.get("mode") || "rolling";

  let dates: string[];
  if (mode === "current") {
    dates = getCurrentWeekDates();
  } else if (mode === "upcoming") {
    dates = getUpcomingWeekDates();
  } else {
    // Default: rolling 2-week window (today + 13 days)
    dates = getRollingTwoWeekDates();
  }

  console.log(`[Fixtures] Starting job for ${dates.length} days: ${dates[0]} to ${dates[dates.length - 1]}`);

  const results: DayResult[] = [];
  let totalFixtures = 0;
  let totalSelected = 0;

  try {
    // Process each day in the date range
    for (const date of dates) {
      console.log(`[Fixtures] Processing ${date}...`);

      // Step 1: Fetch fixtures for this day
      const fixtures = await fetchFixturesByDate(date);
      console.log(`[Fixtures] ${date}: Found ${fixtures.length} fixtures`);

      if (fixtures.length === 0) {
        results.push({ date, total: 0, selected: 0 });
        continue;
      }

      // Store all fixtures for this day
      await setDailyFixtures(date, fixtures);
      for (const fixture of fixtures) {
        await setFixture(fixture);
      }

      // Step 2: Fetch sentiment for each fixture
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

      // Step 3: Generate AI analysis and predictions for ALL fixtures
      // Collect predictions with scores for daily cap enforcement
      const dayPredictions: Array<{
        fixture: Fixture;
        prediction: Prediction;
        topScore: number;
      }> = [];

      for (const fixture of fixtures) {
        const sentiment = sentimentMap.get(fixture.id) || null;

        // Generate AI analysis (no lineups at weekly job time)
        const analysis = await generateAnalysis(fixture, sentiment, null);
        await setAnalysis(analysis);

        // Generate prediction using ENGINE_SPEC scoring model
        const prediction = generateEnginePrediction(fixture, sentiment, analysis);
        await setPrediction(prediction);

        // Get top score for ranking
        const scores = scoreAllMarkets(fixture, sentiment, analysis);
        const topScore = scores.length > 0 ? scores[0].finalScore : 0;

        dayPredictions.push({ fixture, prediction, topScore });

        console.log(
          `[Fixtures] ${date}: ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName} → ${prediction.category}`
        );
      }

      // Per ENGINE_SPEC: Apply daily cap (max 5 bets per calendar day)
      // Sort by top score descending and take top 5
      const rankedPredictions = dayPredictions
        .filter(({ topScore }) => topScore >= 40) // MIN_SCORE_THRESHOLD
        .sort((a, b) => b.topScore - a.topScore)
        .slice(0, DAILY_BET_CAP);

      // Store only the selected fixture IDs for the day
      await setSelectedFixtures(
        date,
        rankedPredictions.map(({ fixture }) => fixture.id)
      );

      totalFixtures += fixtures.length;
      totalSelected += rankedPredictions.length;
      results.push({
        date,
        total: fixtures.length,
        selected: rankedPredictions.length,
      });

      console.log(
        `[Fixtures] ${date}: Selected ${rankedPredictions.length}/${fixtures.length} fixtures (daily cap: ${DAILY_BET_CAP})`
      );
    }

    // Mark job as complete
    await setJobLastRun("fixtures-ingestion", nowGMT1());

    const response = {
      success: true,
      mode,
      dateStart: dates[0],
      dateEnd: dates[dates.length - 1],
      daysProcessed: dates.length,
      totalFixtures,
      totalSelected,
      byDay: results,
    };

    console.log("[Fixtures] Job completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Fixtures] Job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
