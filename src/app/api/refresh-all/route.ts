/**
 * Refresh All Fixtures API
 * Fetches FRESH Polymarket data and regenerates AI analysis
 * This is a manual trigger for users who want to refresh without waiting for cron
 */

import { NextRequest, NextResponse } from "next/server";
import { getTodayGMT1, getRollingTwoWeekDates } from "@/lib/date";
import {
  getSelectedFixtures,
  getFixture,
  getLineups,
  setSentiment,
  setAnalysis,
  setPrediction,
} from "@/lib/kv";
import {
  fetchSentimentForFixture,
  generateAnalysis,
  generateEnginePrediction,
} from "@/services";

export async function POST(request: NextRequest) {
  // Optional: limit to specific date or use today
  const { date } = await request.json().catch(() => ({}));
  const targetDate = date || getTodayGMT1();

  console.log(`[Refresh All] Starting refresh for ${targetDate}`);

  try {
    // Get selected fixtures for the target date
    const selectedIds = await getSelectedFixtures(targetDate);

    if (!selectedIds || selectedIds.length === 0) {
      return NextResponse.json({
        success: true,
        date: targetDate,
        refreshed: 0,
        message: "No fixtures found for this date",
      });
    }

    let refreshed = 0;
    const results: Array<{ fixtureId: number; category: string; hasMarketData: boolean }> = [];

    for (const fixtureId of selectedIds) {
      const fixture = await getFixture(fixtureId);
      if (!fixture) continue;

      // Skip finished matches
      if (fixture.status === "FINISHED") continue;

      // Fetch FRESH Polymarket data
      const sentiment = await fetchSentimentForFixture(
        fixture.id,
        fixture.homeTeam.name,
        fixture.awayTeam.name,
        fixture.leagueCode,
        fixture.kickoff
      );
      await setSentiment(sentiment);

      const lineups = await getLineups(fixtureId);

      // Regenerate analysis and prediction
      const analysis = await generateAnalysis(fixture, sentiment, lineups);
      await setAnalysis(analysis);

      const prediction = generateEnginePrediction(fixture, sentiment, analysis);
      await setPrediction(prediction);

      results.push({
        fixtureId,
        category: prediction.category,
        hasMarketData: sentiment.available,
      });

      refreshed++;
      console.log(
        `[Refresh All] ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${prediction.category} (PM: ${sentiment.available ? sentiment.markets.length + " markets" : "none"})`
      );
    }

    return NextResponse.json({
      success: true,
      date: targetDate,
      refreshed,
      results,
    });
  } catch (error) {
    console.error("[Refresh All] Failed:", error);
    return NextResponse.json(
      { error: "Refresh failed", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for easy browser trigger
 * Refreshes all fixtures for all upcoming dates (rolling 2-week window)
 * Fetches FRESH Polymarket data for each fixture
 */
export async function GET() {
  const dates = getRollingTwoWeekDates();
  console.log(`[Refresh All] Starting full refresh for ${dates.length} days`);

  let totalRefreshed = 0;
  let totalWithMarketData = 0;
  const dayResults: Array<{ date: string; refreshed: number; withMarketData: number }> = [];

  try {
    for (const date of dates) {
      const selectedIds = await getSelectedFixtures(date);
      if (!selectedIds || selectedIds.length === 0) {
        dayResults.push({ date, refreshed: 0, withMarketData: 0 });
        continue;
      }

      let dayRefreshed = 0;
      let dayWithMarketData = 0;

      for (const fixtureId of selectedIds) {
        const fixture = await getFixture(fixtureId);
        if (!fixture) continue;

        // Skip finished matches
        if (fixture.status === "FINISHED") continue;

        // Fetch FRESH Polymarket data
        const sentiment = await fetchSentimentForFixture(
          fixture.id,
          fixture.homeTeam.name,
          fixture.awayTeam.name,
          fixture.leagueCode,
          fixture.kickoff
        );
        await setSentiment(sentiment);

        if (sentiment.available) {
          dayWithMarketData++;
        }

        const lineups = await getLineups(fixtureId);

        // Regenerate analysis and prediction
        const analysis = await generateAnalysis(fixture, sentiment, lineups);
        await setAnalysis(analysis);

        const prediction = generateEnginePrediction(fixture, sentiment, analysis);
        await setPrediction(prediction);

        dayRefreshed++;
        console.log(
          `[Refresh All] ${date}: ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${prediction.category} (PM: ${sentiment.available ? sentiment.markets.length + " markets" : "none"})`
        );
      }

      dayResults.push({ date, refreshed: dayRefreshed, withMarketData: dayWithMarketData });
      totalRefreshed += dayRefreshed;
      totalWithMarketData += dayWithMarketData;
    }

    return NextResponse.json({
      success: true,
      totalRefreshed,
      totalWithMarketData,
      daysProcessed: dates.length,
      byDay: dayResults,
    });
  } catch (error) {
    console.error("[Refresh All] Failed:", error);
    return NextResponse.json(
      { error: "Refresh failed", details: String(error) },
      { status: 500 }
    );
  }
}
