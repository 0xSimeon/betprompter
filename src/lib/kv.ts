/**
 * Vercel KV utilities
 * Key patterns and CRUD operations for all entities
 */

import { kv } from "@vercel/kv";
import { KV_TTL } from "@/config/constants";
import type {
  Fixture,
  Lineups,
  MarketSentiment,
  AIAnalysis,
  Prediction,
  Outcome,
  StatsAggregate,
  FixtureWithPrediction,
} from "@/types";

// ============================================
// Key Patterns
// ============================================

export const KV_KEYS = {
  // Daily fixtures list: fixtures:2026-01-05
  fixturesDaily: (date: string) => `fixtures:${date}`,

  // Single fixture: fixture:501234
  fixture: (fixtureId: number) => `fixture:${fixtureId}`,

  // Lineups: lineups:501234
  lineups: (fixtureId: number) => `lineups:${fixtureId}`,

  // Sentiment: sentiment:501234
  sentiment: (fixtureId: number) => `sentiment:${fixtureId}`,

  // AI Analysis: analysis:501234
  analysis: (fixtureId: number) => `analysis:${fixtureId}`,

  // Prediction: prediction:501234
  prediction: (fixtureId: number) => `prediction:${fixtureId}`,

  // Monthly history: history:2026-01
  historyMonthly: (yearMonth: string) => `history:${yearMonth}`,

  // Aggregate stats
  historyStats: () => "history:stats",

  // Job metadata: job:last-run:daily-fixtures
  jobLastRun: (jobName: string) => `job:last-run:${jobName}`,

  // Selected fixtures for a date (curated subset)
  selectedFixtures: (date: string) => `selected:${date}`,
} as const;

// ============================================
// Fixtures Operations
// ============================================

export async function setDailyFixtures(
  date: string,
  fixtures: Fixture[]
): Promise<void> {
  await kv.set(KV_KEYS.fixturesDaily(date), fixtures, {
    ex: KV_TTL.FIXTURES_DAILY,
  });
}

export async function getDailyFixtures(date: string): Promise<Fixture[] | null> {
  return kv.get<Fixture[]>(KV_KEYS.fixturesDaily(date));
}

export async function setFixture(fixture: Fixture): Promise<void> {
  await kv.set(KV_KEYS.fixture(fixture.id), fixture, {
    ex: KV_TTL.FIXTURE_SINGLE,
  });
}

export async function getFixture(fixtureId: number): Promise<Fixture | null> {
  return kv.get<Fixture>(KV_KEYS.fixture(fixtureId));
}

// ============================================
// Selected Fixtures (Curated Subset)
// ============================================

export async function setSelectedFixtures(
  date: string,
  fixtureIds: number[]
): Promise<void> {
  await kv.set(KV_KEYS.selectedFixtures(date), fixtureIds, {
    ex: KV_TTL.FIXTURES_DAILY,
  });
}

export async function getSelectedFixtures(
  date: string
): Promise<number[] | null> {
  return kv.get<number[]>(KV_KEYS.selectedFixtures(date));
}

// ============================================
// Lineups Operations
// ============================================

export async function setLineups(lineups: Lineups): Promise<void> {
  await kv.set(KV_KEYS.lineups(lineups.fixtureId), lineups, {
    ex: KV_TTL.LINEUPS,
  });
}

export async function getLineups(fixtureId: number): Promise<Lineups | null> {
  return kv.get<Lineups>(KV_KEYS.lineups(fixtureId));
}

// ============================================
// Sentiment Operations
// ============================================

export async function setSentiment(sentiment: MarketSentiment): Promise<void> {
  await kv.set(KV_KEYS.sentiment(sentiment.fixtureId), sentiment, {
    ex: KV_TTL.SENTIMENT,
  });
}

export async function getSentiment(
  fixtureId: number
): Promise<MarketSentiment | null> {
  return kv.get<MarketSentiment>(KV_KEYS.sentiment(fixtureId));
}

// ============================================
// Analysis Operations
// ============================================

export async function setAnalysis(analysis: AIAnalysis): Promise<void> {
  await kv.set(KV_KEYS.analysis(analysis.fixtureId), analysis, {
    ex: KV_TTL.ANALYSIS,
  });
}

export async function getAnalysis(
  fixtureId: number
): Promise<AIAnalysis | null> {
  return kv.get<AIAnalysis>(KV_KEYS.analysis(fixtureId));
}

// ============================================
// Prediction Operations
// ============================================

export async function setPrediction(prediction: Prediction): Promise<void> {
  await kv.set(KV_KEYS.prediction(prediction.fixtureId), prediction, {
    ex: KV_TTL.PREDICTION,
  });
}

export async function getPrediction(
  fixtureId: number
): Promise<Prediction | null> {
  return kv.get<Prediction>(KV_KEYS.prediction(fixtureId));
}

// ============================================
// History Operations
// ============================================

export async function appendToHistory(
  yearMonth: string,
  outcome: Outcome
): Promise<void> {
  const key = KV_KEYS.historyMonthly(yearMonth);
  const existing = (await kv.get<Outcome[]>(key)) || [];
  existing.push(outcome);
  await kv.set(key, existing);
}

export async function getMonthlyHistory(
  yearMonth: string
): Promise<Outcome[] | null> {
  return kv.get<Outcome[]>(KV_KEYS.historyMonthly(yearMonth));
}

export async function setStats(stats: StatsAggregate): Promise<void> {
  await kv.set(KV_KEYS.historyStats(), stats);
}

export async function getStats(): Promise<StatsAggregate | null> {
  return kv.get<StatsAggregate>(KV_KEYS.historyStats());
}

// ============================================
// Job Metadata Operations
// ============================================

export async function setJobLastRun(
  jobName: string,
  timestamp: string
): Promise<void> {
  await kv.set(KV_KEYS.jobLastRun(jobName), timestamp);
}

export async function getJobLastRun(jobName: string): Promise<string | null> {
  return kv.get<string>(KV_KEYS.jobLastRun(jobName));
}

// ============================================
// Composite Operations
// ============================================

/**
 * Get fixtures with their predictions for display
 */
export async function getFixturesWithPredictions(
  date: string
): Promise<FixtureWithPrediction[]> {
  const selectedIds = await getSelectedFixtures(date);
  if (!selectedIds || selectedIds.length === 0) {
    return [];
  }

  const results: FixtureWithPrediction[] = [];

  for (const fixtureId of selectedIds) {
    const fixture = await getFixture(fixtureId);
    if (!fixture) continue;

    // Skip finished, postponed, or cancelled matches
    if (["FINISHED", "POSTPONED", "CANCELLED", "SUSPENDED"].includes(fixture.status)) {
      continue;
    }

    const [sentiment, prediction, lineups] = await Promise.all([
      getSentiment(fixtureId),
      getPrediction(fixtureId),
      getLineups(fixtureId),
    ]);

    results.push({
      ...fixture,
      sentiment,
      prediction,
      lineups,
    });
  }

  // Sort by kickoff time
  return results.sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );
}

/**
 * Get full match detail for a single fixture
 */
export async function getMatchDetail(fixtureId: number) {
  const fixture = await getFixture(fixtureId);
  if (!fixture) return null;

  const [sentiment, analysis, prediction, lineups] = await Promise.all([
    getSentiment(fixtureId),
    getAnalysis(fixtureId),
    getPrediction(fixtureId),
    getLineups(fixtureId),
  ]);

  return {
    ...fixture,
    sentiment,
    analysis,
    prediction,
    lineups,
  };
}
