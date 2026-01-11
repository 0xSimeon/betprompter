/**
 * Daily Fixtures Cron Job
 * Schedule: 05:00 GMT+1 daily (04:00 UTC)
 *
 * Implements Option C: Incremental + Near-Term Refresh
 *
 * 1. Fetch fixtures for rolling 2-week window
 * 2. Identify NEW fixtures (not in KV)
 * 3. Identify fixtures within 48 hours (need fresh data)
 * 4. Run analysis for NEW + 48-hour fixtures only
 * 5. Keep existing analysis for fixtures 3+ days away
 * 6. Apply daily cap (max 5 per day)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRollingTwoWeekDates, nowGMT1, hoursUntilKickoff } from "@/lib/date";
import {
  getDailyFixtures,
  setDailyFixtures,
  getFixture,
  setFixture,
  getSelectedFixtures,
  setSelectedFixtures,
  getSentiment,
  setSentiment,
  getAnalysis,
  setAnalysis,
  getPrediction,
  setPrediction,
  setJobLastRun,
} from "@/lib/kv";
import {
  fetchFixturesByDate,
  fetchSentimentForFixture,
  generateAnalysis,
  generateEnginePrediction,
  scoreAllMarkets,
  DAILY_BET_CAP,
} from "@/services";
import type { Fixture, MarketSentiment, Prediction } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET || "";

// Fixtures within this window get refreshed (hours before kickoff)
const REFRESH_WINDOW_HOURS = 48;

interface DayResult {
  date: string;
  total: number;
  new: number;
  refreshed: number;
  skipped: number;
  selected: number;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dates = getRollingTwoWeekDates();
  console.log(`[Daily Cron] Starting for ${dates.length} days: ${dates[0]} to ${dates[dates.length - 1]}`);

  const results: DayResult[] = [];
  let totalNew = 0;
  let totalRefreshed = 0;
  let totalSkipped = 0;
  let totalSelected = 0;

  try {
    for (const date of dates) {
      console.log(`[Daily Cron] Processing ${date}...`);

      // Step 1: Fetch fixtures for this day from API
      const apiFixtures = await fetchFixturesByDate(date);

      if (apiFixtures.length === 0) {
        results.push({ date, total: 0, new: 0, refreshed: 0, skipped: 0, selected: 0 });
        continue;
      }

      // Store fixtures list for this day
      await setDailyFixtures(date, apiFixtures);

      // Step 2: Categorize fixtures
      const newFixtures: Fixture[] = [];
      const refreshFixtures: Fixture[] = [];
      const skipFixtures: Fixture[] = [];

      for (const fixture of apiFixtures) {
        // Store/update the fixture record
        await setFixture(fixture);

        // Skip finished matches
        if (["FINISHED", "POSTPONED", "CANCELLED", "SUSPENDED"].includes(fixture.status)) {
          skipFixtures.push(fixture);
          continue;
        }

        // Check if we already have analysis for this fixture
        const existingAnalysis = await getAnalysis(fixture.id);
        const hoursUntil = hoursUntilKickoff(fixture.kickoff);

        if (!existingAnalysis) {
          // NEW fixture - never analyzed
          newFixtures.push(fixture);
        } else if (hoursUntil <= REFRESH_WINDOW_HOURS && hoursUntil > 0) {
          // Within 48-hour window - needs refresh for fresh Polymarket data
          refreshFixtures.push(fixture);
        } else {
          // Existing fixture, not in refresh window - skip
          skipFixtures.push(fixture);
        }
      }

      console.log(`[Daily Cron] ${date}: ${newFixtures.length} new, ${refreshFixtures.length} refresh, ${skipFixtures.length} skip`);

      // Step 3: Process NEW fixtures (always analyze)
      const dayPredictions: Array<{
        fixture: Fixture;
        prediction: Prediction;
        topScore: number;
      }> = [];

      for (const fixture of newFixtures) {
        const sentiment = await fetchSentimentForFixture(
          fixture.id,
          fixture.homeTeam.name,
          fixture.awayTeam.name,
          fixture.leagueCode,
          fixture.kickoff
        );
        await setSentiment(sentiment);

        const analysis = await generateAnalysis(fixture, sentiment, null);
        await setAnalysis(analysis);

        const prediction = generateEnginePrediction(fixture, sentiment, analysis);
        await setPrediction(prediction);

        const scores = scoreAllMarkets(fixture, sentiment, analysis);
        const topScore = scores.length > 0 ? scores[0].finalScore : 0;

        dayPredictions.push({ fixture, prediction, topScore });

        console.log(`[Daily Cron] NEW: ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName} → ${prediction.category}`);
      }

      // Step 4: Process REFRESH fixtures (within 48 hours)
      for (const fixture of refreshFixtures) {
        const sentiment = await fetchSentimentForFixture(
          fixture.id,
          fixture.homeTeam.name,
          fixture.awayTeam.name,
          fixture.leagueCode,
          fixture.kickoff
        );
        await setSentiment(sentiment);

        const analysis = await generateAnalysis(fixture, sentiment, null);
        await setAnalysis(analysis);

        const prediction = generateEnginePrediction(fixture, sentiment, analysis);
        await setPrediction(prediction);

        const scores = scoreAllMarkets(fixture, sentiment, analysis);
        const topScore = scores.length > 0 ? scores[0].finalScore : 0;

        dayPredictions.push({ fixture, prediction, topScore });

        console.log(`[Daily Cron] REFRESH: ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName} → ${prediction.category}`);
      }

      // Step 5: Include SKIPPED fixtures with existing predictions in ranking
      for (const fixture of skipFixtures) {
        if (["FINISHED", "POSTPONED", "CANCELLED", "SUSPENDED"].includes(fixture.status)) {
          continue; // Don't include finished matches
        }

        const existingPrediction = await getPrediction(fixture.id);
        if (existingPrediction) {
          const sentiment = await getSentiment(fixture.id);
          const analysis = await getAnalysis(fixture.id);

          if (analysis) {
            const scores = scoreAllMarkets(fixture, sentiment, analysis);
            const topScore = scores.length > 0 ? scores[0].finalScore : 0;
            dayPredictions.push({ fixture, prediction: existingPrediction, topScore });
          }
        }
      }

      // Step 6: Apply daily cap (max 5 per day)
      const rankedPredictions = dayPredictions
        .filter(({ topScore }) => topScore >= 40) // MIN_SCORE_THRESHOLD
        .sort((a, b) => b.topScore - a.topScore)
        .slice(0, DAILY_BET_CAP);

      await setSelectedFixtures(
        date,
        rankedPredictions.map(({ fixture }) => fixture.id)
      );

      // Track results
      results.push({
        date,
        total: apiFixtures.length,
        new: newFixtures.length,
        refreshed: refreshFixtures.length,
        skipped: skipFixtures.length,
        selected: rankedPredictions.length,
      });

      totalNew += newFixtures.length;
      totalRefreshed += refreshFixtures.length;
      totalSkipped += skipFixtures.length;
      totalSelected += rankedPredictions.length;

      console.log(`[Daily Cron] ${date}: Selected ${rankedPredictions.length} fixtures`);
    }

    // Mark job as complete
    await setJobLastRun("daily-fixtures", nowGMT1());

    const response = {
      success: true,
      dateStart: dates[0],
      dateEnd: dates[dates.length - 1],
      daysProcessed: dates.length,
      summary: {
        new: totalNew,
        refreshed: totalRefreshed,
        skipped: totalSkipped,
        selected: totalSelected,
        apiCalls: totalNew + totalRefreshed, // Groq + Gemini calls
      },
      byDay: results,
    };

    console.log("[Daily Cron] Job completed:", JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Daily Cron] Job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
