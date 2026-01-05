/**
 * Post-Match Settlement Cron Job
 * Schedule: 23:00 GMT+1 daily (22:00 UTC)
 *
 * 1. Fetch final scores for finished matches
 * 2. Evaluate predictions
 * 3. Record outcomes in history
 * 4. Update aggregate stats
 */

import { NextRequest, NextResponse } from "next/server";
import { getTodayGMT1, nowGMT1, formatYearMonthGMT1 } from "@/lib/date";
import {
  getSelectedFixtures,
  getFixture,
  getPrediction,
  appendToHistory,
  getStats,
  setStats,
  setJobLastRun,
} from "@/lib/kv";
import { fetchFinalScore, evaluatePrediction } from "@/services";
import type { Outcome, StatsAggregate, OutcomeResult } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET || "";

function initializeStats(): StatsAggregate {
  return {
    total: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    voids: 0,
    byCategory: {
      banker: { total: 0, wins: 0, losses: 0, pushes: 0 },
      value: { total: 0, wins: 0, losses: 0, pushes: 0 },
    },
    byMarket: {
      MATCH_RESULT: { total: 0, wins: 0, losses: 0, pushes: 0 },
      DOUBLE_CHANCE: { total: 0, wins: 0, losses: 0, pushes: 0 },
      OVER_1_5: { total: 0, wins: 0, losses: 0, pushes: 0 },
      OVER_2_5: { total: 0, wins: 0, losses: 0, pushes: 0 },
    },
    lastUpdated: nowGMT1(),
  };
}

function updateStats(
  stats: StatsAggregate,
  outcome: Outcome,
  result: OutcomeResult
): void {
  stats.total++;

  if (result === "WIN") stats.wins++;
  else if (result === "LOSS") stats.losses++;
  else if (result === "PUSH") stats.pushes++;
  else if (result === "VOID") stats.voids++;

  // Update by category
  const category = outcome.prediction.category.toLowerCase() as "banker" | "value";
  if (stats.byCategory[category]) {
    stats.byCategory[category].total++;
    if (result === "WIN") stats.byCategory[category].wins++;
    else if (result === "LOSS") stats.byCategory[category].losses++;
    else if (result === "PUSH") stats.byCategory[category].pushes++;
  }

  // Update by market
  const marketType = outcome.prediction.marketType;
  if (stats.byMarket[marketType]) {
    stats.byMarket[marketType].total++;
    if (result === "WIN") stats.byMarket[marketType].wins++;
    else if (result === "LOSS") stats.byMarket[marketType].losses++;
    else if (result === "PUSH") stats.byMarket[marketType].pushes++;
  }

  stats.lastUpdated = nowGMT1();
}

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayGMT1();
  const yearMonth = formatYearMonthGMT1(new Date());
  console.log(`[Settlement] Starting job for ${today}`);

  try {
    // Get selected fixtures for today
    const selectedIds = await getSelectedFixtures(today);

    if (!selectedIds || selectedIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No selected fixtures today",
        settled: 0,
      });
    }

    // Load current stats
    let stats = await getStats();
    if (!stats) {
      stats = initializeStats();
    }

    let settled = 0;
    const results: Array<{ match: string; result: OutcomeResult }> = [];

    for (const fixtureId of selectedIds) {
      const fixture = await getFixture(fixtureId);
      if (!fixture) continue;

      const prediction = await getPrediction(fixtureId);
      if (!prediction) continue;

      // Skip NO_BET predictions
      if (prediction.category === "NO_BET") continue;

      // Fetch final score
      const finalScore = await fetchFinalScore(fixtureId);

      if (!finalScore) {
        console.log(`[Settlement] No final score for ${fixtureId}, skipping`);
        continue;
      }

      // Evaluate prediction
      const result = evaluatePrediction(prediction, finalScore);

      // Build outcome record
      const outcome: Outcome = {
        id: `${fixtureId}-${today}`,
        date: today,
        fixtureId,
        leagueCode: fixture.leagueCode,
        homeTeam: fixture.homeTeam.name,
        awayTeam: fixture.awayTeam.name,
        prediction: {
          category: prediction.category,
          marketType: prediction.primaryMarket!.type,
          selection: prediction.primaryMarket!.selection,
          confidence: prediction.primaryMarket!.confidence,
        },
        finalScore,
        result,
        settledAt: nowGMT1(),
      };

      // Save to history
      await appendToHistory(yearMonth, outcome);

      // Update stats
      updateStats(stats, outcome, result);

      results.push({
        match: `${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}`,
        result,
      });

      settled++;

      console.log(
        `[Settlement] ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${result} (${finalScore.home}-${finalScore.away})`
      );
    }

    // Save updated stats
    await setStats(stats);
    await setJobLastRun("settlement", nowGMT1());

    const response = {
      success: true,
      date: today,
      settled,
      results,
      stats: {
        total: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
      },
    };

    console.log("[Settlement] Job completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Settlement] Job failed:", error);
    return NextResponse.json(
      { error: "Job failed", details: String(error) },
      { status: 500 }
    );
  }
}
