/**
 * Settlement Service
 * Extracted core settlement logic for reuse by cron and manual triggers
 */

import { formatYearMonthGMT1, nowGMT1 } from "@/lib/date";
import {
  getSelectedFixtures,
  getFixture,
  getPrediction,
  appendToHistory,
  getMonthlyHistory,
  getStats,
  setStats,
} from "@/lib/kv";
import { fetchFinalScore } from "./football-data";
import { evaluatePrediction } from "./prediction";
import type { Outcome, StatsAggregate, OutcomeResult } from "@/types";

export interface SettlementResult {
  success: boolean;
  date: string;
  settled: number;
  skippedDuplicates: number;
  skippedNoMarket: number;
  skippedNoScore: number;
  results: Array<{ match: string; result: OutcomeResult }>;
  stats: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

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
      risky: { total: 0, wins: 0, losses: 0, pushes: 0 },
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
  const category = outcome.prediction.category.toLowerCase() as
    | "banker"
    | "value"
    | "risky";
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

/**
 * Settle fixtures for a specific date
 * Idempotent: skips already-settled fixtures
 */
export async function settleFixturesForDate(
  date: string
): Promise<SettlementResult> {
  const yearMonth = formatYearMonthGMT1(new Date(date));
  console.log(`[Settlement] Starting settlement for ${date}`);

  // Get selected fixtures for the date
  const selectedIds = await getSelectedFixtures(date);

  if (!selectedIds || selectedIds.length === 0) {
    return {
      success: true,
      date,
      settled: 0,
      skippedDuplicates: 0,
      skippedNoMarket: 0,
      skippedNoScore: 0,
      results: [],
      stats: { total: 0, wins: 0, losses: 0, winRate: 0 },
    };
  }

  // Load current stats
  let stats = await getStats();
  if (!stats) {
    stats = initializeStats();
  }

  // Load existing history to check for duplicates (idempotency)
  const existingHistory = await getMonthlyHistory(yearMonth);
  const alreadySettled = new Set(
    existingHistory?.map((o) => o.fixtureId) || []
  );

  let settled = 0;
  let skippedDuplicates = 0;
  let skippedNoMarket = 0;
  let skippedNoScore = 0;
  const results: Array<{ match: string; result: OutcomeResult }> = [];

  for (const fixtureId of selectedIds) {
    // Skip if already settled (idempotency)
    if (alreadySettled.has(fixtureId)) {
      skippedDuplicates++;
      continue;
    }

    const fixture = await getFixture(fixtureId);
    if (!fixture) continue;

    const prediction = await getPrediction(fixtureId);
    if (!prediction) continue;

    // Guard: Skip if no primary market (fixes null assertion crash)
    if (!prediction.primaryMarket) {
      console.log(
        `[Settlement] No primary market for ${fixtureId} (${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}), skipping`
      );
      skippedNoMarket++;
      continue;
    }

    // Fetch final score
    const finalScore = await fetchFinalScore(fixtureId);

    if (!finalScore) {
      console.log(
        `[Settlement] No final score for ${fixtureId} (${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}), skipping`
      );
      skippedNoScore++;
      continue;
    }

    // Evaluate prediction
    const result = evaluatePrediction(prediction, finalScore);

    // Build outcome record
    const outcome: Outcome = {
      id: `${fixtureId}-${date}`,
      date,
      fixtureId,
      leagueCode: fixture.leagueCode,
      homeTeam: fixture.homeTeam.name,
      awayTeam: fixture.awayTeam.name,
      prediction: {
        category: prediction.category,
        marketType: prediction.primaryMarket.type,
        selection: prediction.primaryMarket.selection,
        confidence: prediction.primaryMarket.confidence,
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

  return {
    success: true,
    date,
    settled,
    skippedDuplicates,
    skippedNoMarket,
    skippedNoScore,
    results,
    stats: {
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRate:
        stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
    },
  };
}
