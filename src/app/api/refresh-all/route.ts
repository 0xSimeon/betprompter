/**
 * Refresh All Fixtures API
 * Regenerates AI analysis and predictions for all fixtures in a date range
 * This is a manual trigger for users who want to refresh without waiting for cron
 */

import { NextRequest, NextResponse } from "next/server";
import { getTodayGMT1, getRollingTwoWeekDates } from "@/lib/date";
import {
  getSelectedFixtures,
  getFixture,
  getSentiment,
  getLineups,
  setAnalysis,
  setPrediction,
} from "@/lib/kv";
import { generateAnalysis, generateEnginePrediction } from "@/services";

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
    const results: Array<{ fixtureId: number; category: string }> = [];

    for (const fixtureId of selectedIds) {
      const fixture = await getFixture(fixtureId);
      if (!fixture) continue;

      // Skip finished matches
      if (fixture.status === "FINISHED") continue;

      const [sentiment, lineups] = await Promise.all([
        getSentiment(fixtureId),
        getLineups(fixtureId),
      ]);

      // Regenerate analysis and prediction
      const analysis = await generateAnalysis(fixture, sentiment, lineups);
      await setAnalysis(analysis);

      const prediction = generateEnginePrediction(fixture, sentiment, analysis);
      await setPrediction(prediction);

      results.push({
        fixtureId,
        category: prediction.category,
      });

      refreshed++;
      console.log(
        `[Refresh All] ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${prediction.category}`
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
 */
export async function GET() {
  const dates = getRollingTwoWeekDates();
  console.log(`[Refresh All] Starting full refresh for ${dates.length} days`);

  let totalRefreshed = 0;
  const dayResults: Array<{ date: string; refreshed: number }> = [];

  try {
    for (const date of dates) {
      const selectedIds = await getSelectedFixtures(date);
      if (!selectedIds || selectedIds.length === 0) {
        dayResults.push({ date, refreshed: 0 });
        continue;
      }

      let dayRefreshed = 0;

      for (const fixtureId of selectedIds) {
        const fixture = await getFixture(fixtureId);
        if (!fixture) continue;

        // Skip finished matches
        if (fixture.status === "FINISHED") continue;

        const [sentiment, lineups] = await Promise.all([
          getSentiment(fixtureId),
          getLineups(fixtureId),
        ]);

        // Regenerate analysis and prediction
        const analysis = await generateAnalysis(fixture, sentiment, lineups);
        await setAnalysis(analysis);

        const prediction = generateEnginePrediction(fixture, sentiment, analysis);
        await setPrediction(prediction);

        dayRefreshed++;
        console.log(
          `[Refresh All] ${date}: ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${prediction.category}`
        );
      }

      dayResults.push({ date, refreshed: dayRefreshed });
      totalRefreshed += dayRefreshed;
    }

    return NextResponse.json({
      success: true,
      totalRefreshed,
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
