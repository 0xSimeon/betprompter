/**
 * Weekly Fixtures Cron Job
 * Schedule: Sunday 22:00 GMT+1 (21:00 UTC)
 *
 * 1. Fetch fixtures for upcoming week (Mon-Sun)
 * 2. For each day: filter to selected fixtures
 * 3. Fetch sentiment for each selected fixture
 * 4. Generate AI analysis (without lineups)
 * 5. Generate predictions
 * 6. Store all in KV
 */

import { NextRequest, NextResponse } from "next/server";
import { getUpcomingWeekDates, getCurrentWeekDates, nowGMT1 } from "@/lib/date";
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
import type { Fixture, MarketSentiment } from "@/types";

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

  // Use ?current=true to fetch current week instead of upcoming week
  const fetchCurrentWeek = request.nextUrl.searchParams.get("current") === "true";
  const weekDates = fetchCurrentWeek ? getCurrentWeekDates() : getUpcomingWeekDates();
  console.log(`[Weekly Fixtures] Starting job for week: ${weekDates[0]} to ${weekDates[6]}`);

  const results: DayResult[] = [];
  let totalFixtures = 0;
  let totalSelected = 0;

  try {
    // Process each day of the week
    for (const date of weekDates) {
      console.log(`[Weekly Fixtures] Processing ${date}...`);

      // Step 1: Fetch fixtures for this day
      const fixtures = await fetchFixturesByDate(date);
      console.log(`[Weekly Fixtures] ${date}: Found ${fixtures.length} fixtures`);

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

      // Store all fixture IDs (we now analyze all fixtures)
      await setSelectedFixtures(
        date,
        fixtures.map((f: Fixture) => f.id)
      );

      // Step 3: Generate AI analysis and predictions for ALL fixtures
      for (const fixture of fixtures) {
        const sentiment = sentimentMap.get(fixture.id) || null;

        // Generate AI analysis (no lineups at weekly job time)
        const analysis = await generateAnalysis(fixture, sentiment, null);
        await setAnalysis(analysis);

        // Generate prediction
        const prediction = generatePrediction(fixture, sentiment, analysis);
        await setPrediction(prediction);

        console.log(
          `[Weekly Fixtures] ${date}: ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName} → ${prediction.category}`
        );
      }

      totalFixtures += fixtures.length;
      totalSelected += fixtures.length;
      results.push({
        date,
        total: fixtures.length,
        selected: fixtures.length,
      });
    }

    // Mark job as complete
    await setJobLastRun("weekly-fixtures", nowGMT1());

    const response = {
      success: true,
      weekStart: weekDates[0],
      weekEnd: weekDates[6],
      totalFixtures,
      totalSelected,
      byDay: results,
    };

    console.log("[Weekly Fixtures] Job completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Weekly Fixtures] Job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
