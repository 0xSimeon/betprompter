/**
 * Prediction Generator
 * Combines sentiment + AI analysis to produce final predictions
 * Classification is deterministic + AI-informed
 */

import {
  BANKER_PROBABILITY_THRESHOLD,
  VALUE_PROBABILITY_MIN,
} from "@/config/constants";
import { nowGMT1, getTodayGMT1, formatYearMonthGMT1 } from "@/lib/date";
import {
  getFixture,
  getPrediction,
  appendToHistory,
  getStats,
  setStats,
  getMonthlyHistory,
} from "@/lib/kv";
import { fetchFinalScore } from "./football-data";
import type {
  Fixture,
  MarketSentiment,
  AIAnalysis,
  Prediction,
  PredictionCategory,
  MarketSelection,
  Outcome,
  StatsAggregate,
  OutcomeResult,
} from "@/types";

/**
 * Get the highest probability outcome from match result market
 */
function getTopOutcome(
  sentiment: MarketSentiment | null
): { name: string; probability: number } | null {
  if (!sentiment?.available) return null;

  const matchResult = sentiment.markets.find((m) => m.type === "MATCH_RESULT");
  if (!matchResult) return null;

  return matchResult.outcomes.reduce((a, b) =>
    a.probability > b.probability ? a : b
  );
}

/**
 * Get total trading volume as confidence proxy
 */
function getMarketVolume(sentiment: MarketSentiment | null): number {
  if (!sentiment?.available) return 0;

  return sentiment.markets.reduce((sum, m) => sum + m.volume, 0);
}

/**
 * Check if AI lean direction aligns with market's top outcome
 * Returns: 1 for aligned, 0 for neutral, -1 for conflicting
 */
function getAIMarketAlignment(
  aiLean: string,
  marketTopOutcome: { name: string; probability: number } | null
): number {
  if (!marketTopOutcome || aiLean === "NEUTRAL") return 0;

  const marketDirection = marketTopOutcome.name.toLowerCase();
  const aiDirection = aiLean.toLowerCase();

  // Check alignment
  if (
    (aiDirection === "home" && marketDirection.includes("home")) ||
    (aiDirection === "away" && marketDirection.includes("away")) ||
    (aiDirection === "draw" && marketDirection.includes("draw"))
  ) {
    return 1; // Aligned
  }

  // Check conflict (AI says one thing, market says another strongly)
  if (marketTopOutcome.probability >= 0.5) {
    if (
      (aiDirection === "home" && marketDirection.includes("away")) ||
      (aiDirection === "away" && marketDirection.includes("home"))
    ) {
      return -1; // Conflicting
    }
  }

  return 0; // Neutral/unclear
}

/**
 * Calculate Expected Value (EV) for a bet
 * EV = (AI_Probability * Potential_Win) - (1 - AI_Probability) * Stake
 * Simplified: EV% = AI_Prob - Market_Prob (edge over market)
 */
function calculateEV(
  aiProb: number,
  marketProb: number
): { ev: number; hasEdge: boolean; edgePercent: number } {
  // Edge is the difference between AI's probability and market's implied probability
  const edge = aiProb - marketProb;
  const edgePercent = Math.round(edge * 100);

  // Consider it valuable if AI sees >5% edge over market
  const hasEdge = edge > 0.05;

  return { ev: edge, hasEdge, edgePercent };
}

/**
 * Get AI probability for a specific lean direction
 */
function getAIProbForLean(
  aiLean: string,
  probabilities: { homeWin: number; draw: number; awayWin: number } | undefined
): number {
  if (!probabilities) return 0.5; // Default 50% if no probabilities

  switch (aiLean.toUpperCase()) {
    case "HOME":
      return probabilities.homeWin;
    case "AWAY":
      return probabilities.awayWin;
    case "DRAW":
      return probabilities.draw;
    default:
      return 0.5;
  }
}

/**
 * Get market probability for AI's lean direction
 */
function getMarketProbForLean(
  aiLean: string,
  sentiment: MarketSentiment | null
): number {
  if (!sentiment?.available) return 0.5;

  const matchResult = sentiment.markets.find((m) => m.type === "MATCH_RESULT");
  if (!matchResult) return 0.5;

  const leanLower = aiLean.toLowerCase();
  const outcome = matchResult.outcomes.find((o) => {
    const nameLower = o.name.toLowerCase();
    return (
      (leanLower === "home" && nameLower.includes("home")) ||
      (leanLower === "away" && nameLower.includes("away")) ||
      (leanLower === "draw" && nameLower.includes("draw"))
    );
  });

  return outcome?.probability || 0.5;
}

/**
 * Determine prediction category based on AI + Market confluence + EV
 *
 * BANKER: Strong agreement between AI and market (high confidence, positive EV, aligned)
 * VALUE: AI sees edge that market may be undervaluing (positive EV but higher risk)
 * RISKY: Lower confidence or negative EV
 *
 * NOTE: We ALWAYS provide a prediction. RISKY replaces the old NO_BET.
 */
function classifyPrediction(
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): PredictionCategory {
  const topOutcome = getTopOutcome(sentiment);
  const volume = getMarketVolume(sentiment);
  const hasMarketData = sentiment?.available && topOutcome;
  const { groqAnalysis, geminiVerification } = analysis;
  const aiConfidence = groqAnalysis.confidence;
  const aiLean = groqAnalysis.lean;
  const hasSuggestedOutcome = !!groqAnalysis.suggestedOutcome;

  // Get AI's probability estimate for their lean
  const aiProb = getAIProbForLean(aiLean, groqAnalysis.probabilities);
  const marketProb = getMarketProbForLean(aiLean, sentiment);
  const { hasEdge, edgePercent } = calculateEV(aiProb, marketProb);

  // Per ENGINE_SPEC: Use Gemini flags for risk assessment
  const geminiClean = !geminiVerification.overconfidence &&
                      !geminiVerification.missingContext &&
                      geminiVerification.cautionLevel === "none";
  const geminiAcceptable = geminiVerification.cautionLevel !== "strong";

  // No market data cases - rely solely on AI
  if (!hasMarketData) {
    if (aiConfidence === "HIGH" && aiProb >= 0.65 && geminiClean) {
      return "VALUE"; // Strong AI conviction without market data
    }
    if (aiConfidence === "MEDIUM" && aiProb >= 0.55) {
      return "VALUE";
    }
    return "RISKY";
  }

  const alignment = getAIMarketAlignment(aiLean, topOutcome);

  // BANKER: Strong confluence between AI and market
  // - Market favors the outcome (>=65%)
  // - AI agrees (alignment >= 0)
  // - AI has high probability estimate (>=60%)
  // - Sufficient volume (liquidity)
  // - No strong Gemini caution
  if (
    topOutcome.probability >= 0.65 &&
    alignment >= 0 &&
    aiProb >= 0.60 &&
    volume >= 500 &&
    geminiAcceptable
  ) {
    return "BANKER";
  }

  // BANKER with even stronger AI conviction
  if (
    aiProb >= 0.70 &&
    alignment === 1 && // AI agrees with market leader
    aiConfidence === "HIGH" &&
    geminiClean
  ) {
    return "BANKER";
  }

  // VALUE: AI sees positive edge over market (>5% edge)
  if (hasEdge && edgePercent >= 5) {
    // AI thinks this outcome is undervalued by market
    if (aiConfidence !== "LOW" && geminiAcceptable) {
      return "VALUE";
    }
  }

  // VALUE: Market shows opportunity but not dominant
  if (
    topOutcome.probability >= VALUE_PROBABILITY_MIN &&
    topOutcome.probability < BANKER_PROBABILITY_THRESHOLD &&
    aiConfidence !== "LOW" &&
    hasSuggestedOutcome
  ) {
    return "VALUE";
  }

  // VALUE: AI confident despite market not strongly agreeing
  if (aiConfidence === "HIGH" && aiProb >= 0.55 && alignment >= 0) {
    return "VALUE";
  }

  // RISKY: Everything else
  // - Conflicting signals (AI vs market)
  // - Low AI confidence
  // - Negative or minimal edge
  // - Gemini flagged issues
  return "RISKY";
}

/**
 * Build primary market selection
 * NOTE: Always returns a market - even for RISKY predictions
 */
function buildPrimaryMarket(
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis,
  _category: PredictionCategory
): MarketSelection | null {
  const { groqAnalysis } = analysis;

  // Use AI suggested market/outcome if available
  if (groqAnalysis.suggestedMarket && groqAnalysis.suggestedOutcome) {
    const market = sentiment?.markets.find(
      (m) => m.type === groqAnalysis.suggestedMarket
    );

    const outcome = market?.outcomes.find((o) =>
      o.name.toLowerCase().includes(groqAnalysis.suggestedOutcome!.toLowerCase())
    );

    return {
      type: groqAnalysis.suggestedMarket,
      selection: groqAnalysis.suggestedOutcome,
      confidence: Math.round((outcome?.probability || 0.5) * 100),
      reasoning: groqAnalysis.narrative.split(".")[0] + ".",
    };
  }

  // Fallback to match result top outcome from market
  const topOutcome = getTopOutcome(sentiment);
  if (topOutcome) {
    return {
      type: "MATCH_RESULT",
      selection: topOutcome.name,
      confidence: Math.round(topOutcome.probability * 100),
      reasoning: groqAnalysis.narrative.split(".")[0] + ".",
    };
  }

  // Last resort: Use AI lean to generate a pick even without market data
  if (groqAnalysis.lean !== "NEUTRAL") {
    const leanToSelection: Record<string, string> = {
      HOME: "Home Win",
      AWAY: "Away Win",
      DRAW: "Draw",
    };
    return {
      type: "MATCH_RESULT",
      selection: leanToSelection[groqAnalysis.lean] || "Home Win",
      confidence: groqAnalysis.confidence === "HIGH" ? 65 : groqAnalysis.confidence === "MEDIUM" ? 50 : 35,
      reasoning: groqAnalysis.narrative.split(".")[0] + ".",
    };
  }

  // Absolute fallback - always provide something
  return {
    type: "MATCH_RESULT",
    selection: "Home Win",
    confidence: 30,
    reasoning: "Insufficient data for confident analysis.",
  };
}

/**
 * Build alternative (safer) market selection
 */
function buildAlternativeMarket(
  _sentiment: MarketSentiment | null,
  _analysis: AIAnalysis,
  primaryMarket: MarketSelection | null
): MarketSelection | null {
  if (!primaryMarket || primaryMarket.type !== "MATCH_RESULT") return null;

  // Suggest double chance if primary is match result
  let alternativeSelection: string | null = null;

  if (primaryMarket.selection.includes("Home")) {
    alternativeSelection = "1X"; // Home or Draw
  } else if (primaryMarket.selection.includes("Away")) {
    alternativeSelection = "X2"; // Away or Draw
  }

  if (alternativeSelection) {
    return {
      type: "DOUBLE_CHANCE",
      selection: alternativeSelection,
      confidence: Math.min(primaryMarket.confidence + 15, 95),
      reasoning: "Safer coverage including draw outcome.",
    };
  }

  return null;
}

/**
 * Build all market tips from AI probabilities
 * Per ENGINE_SPEC: Only ML, DC, O1.5, O2.5 are supported
 */
function buildAllMarkets(
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis,
  primaryMarket: MarketSelection | null
): MarketSelection[] {
  const markets: MarketSelection[] = [];
  const probs = analysis.groqAnalysis.probabilities;
  if (!probs) return markets;

  const primaryType = primaryMarket?.type;

  // Helper to get market probability from sentiment
  const getMarketProb = (
    marketType: string,
    outcome: string
  ): number | null => {
    if (!sentiment?.available) return null;
    const market = sentiment.markets.find((m) => m.type === marketType);
    const found = market?.outcomes.find((o) =>
      o.name.toLowerCase().includes(outcome.toLowerCase())
    );
    return found ? Math.round(found.probability * 100) : null;
  };

  // Over 1.5 Goals (skip if it's the primary market)
  if (primaryType !== "OVER_1_5" && probs.over15 >= 0.45) {
    const marketProb = getMarketProb("OVER_1_5", "over");
    markets.push({
      type: "OVER_1_5",
      selection: "Over 1.5",
      confidence: Math.round(probs.over15 * 100),
      reasoning: marketProb
        ? `AI: ${Math.round(probs.over15 * 100)}% vs Market: ${marketProb}%`
        : `AI estimates ${Math.round(probs.over15 * 100)}% chance`,
    });
  }

  // Over 2.5 Goals (skip if it's the primary market)
  if (primaryType !== "OVER_2_5" && probs.over25 >= 0.40) {
    const marketProb = getMarketProb("OVER_2_5", "over");
    markets.push({
      type: "OVER_2_5",
      selection: "Over 2.5",
      confidence: Math.round(probs.over25 * 100),
      reasoning: marketProb
        ? `AI: ${Math.round(probs.over25 * 100)}% vs Market: ${marketProb}%`
        : `AI estimates ${Math.round(probs.over25 * 100)}% chance`,
    });
  }

  // Per ENGINE_SPEC: BTTS is not a supported market - removed

  // Double Chance based on AI lean (skip if it's the primary or alternative market)
  const lean = analysis.groqAnalysis.lean;
  if (primaryType !== "DOUBLE_CHANCE") {
    if (lean === "HOME" && probs.homeWin >= 0.35) {
      const combinedProb = probs.homeWin + probs.draw;
      markets.push({
        type: "DOUBLE_CHANCE",
        selection: "1X",
        confidence: Math.round(combinedProb * 100),
        reasoning: `Home or Draw covers ${Math.round(combinedProb * 100)}% of outcomes`,
      });
    } else if (lean === "AWAY" && probs.awayWin >= 0.35) {
      const combinedProb = probs.awayWin + probs.draw;
      markets.push({
        type: "DOUBLE_CHANCE",
        selection: "X2",
        confidence: Math.round(combinedProb * 100),
        reasoning: `Away or Draw covers ${Math.round(combinedProb * 100)}% of outcomes`,
      });
    }
  }

  // Sort by confidence descending
  return markets.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Generate disclaimers based on analysis
 * For RISKY picks, these become the "Why Risky?" reasons
 * Per ENGINE_SPEC: Uses Gemini risk flags
 */
function generateDisclaimers(
  analysis: AIAnalysis,
  category: PredictionCategory
): string[] {
  const disclaimers: string[] = [];

  // Add concerns from AI
  if (analysis.groqAnalysis.concerns.length > 0) {
    disclaimers.push(...analysis.groqAnalysis.concerns);
  }

  // Add Gemini risk flags per ENGINE_SPEC
  if (analysis.geminiVerification.overconfidence) {
    disclaimers.push(
      analysis.geminiVerification.overconfidenceReason ||
        "Analysis may overstate confidence."
    );
  }

  if (analysis.geminiVerification.missingContext) {
    disclaimers.push(
      analysis.geminiVerification.missingContextReason ||
        "Some contextual factors may be missing."
    );
  }

  // Category-specific reasons
  if (category === "VALUE") {
    disclaimers.push("Value play - higher risk, potential mispricing.");
  }

  if (category === "RISKY") {
    // Add specific reasons why this is risky
    if (analysis.groqAnalysis.confidence === "LOW") {
      disclaimers.push("AI confidence is low for this fixture.");
    }
    if (analysis.groqAnalysis.lean === "NEUTRAL") {
      disclaimers.push("No clear directional edge identified.");
    }
    if (analysis.geminiVerification.cautionLevel === "strong") {
      disclaimers.push("Strong caution flagged by risk review.");
    }
    // Ensure we always have at least one reason for RISKY
    if (disclaimers.length === 0) {
      disclaimers.push("Conflicting signals between AI and market data.");
    }
  }

  return disclaimers;
}

/**
 * Generate full prediction for a fixture
 */
export function generatePrediction(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): Prediction {
  const category = classifyPrediction(sentiment, analysis);
  const primaryMarket = buildPrimaryMarket(sentiment, analysis, category);
  const alternativeMarket = buildAlternativeMarket(
    sentiment,
    analysis,
    primaryMarket
  );
  const allMarkets = buildAllMarkets(sentiment, analysis, primaryMarket);
  const disclaimers = generateDisclaimers(analysis, category);

  return {
    fixtureId: fixture.id,
    generatedAt: nowGMT1(),
    category,
    primaryMarket,
    alternativeMarket,
    allMarkets,
    narrative: analysis.groqAnalysis.narrative,
    keyFactors: analysis.groqAnalysis.keyFactors,
    disclaimers,
  };
}

/**
 * Evaluate prediction result against final score
 */
export function evaluatePrediction(
  prediction: Prediction,
  finalScore: { home: number; away: number }
): "WIN" | "LOSS" | "PUSH" | "VOID" {
  if (!prediction.primaryMarket) return "VOID";

  const { type, selection } = prediction.primaryMarket;
  const { home, away } = finalScore;
  const total = home + away;

  switch (type) {
    case "MATCH_RESULT":
      if (selection.includes("Home") && home > away) return "WIN";
      if (selection.includes("Draw") && home === away) return "WIN";
      if (selection.includes("Away") && away > home) return "WIN";
      return "LOSS";

    case "DOUBLE_CHANCE":
      if (selection === "1X" && home >= away) return "WIN";
      if (selection === "X2" && away >= home) return "WIN";
      if (selection === "12" && home !== away) return "WIN";
      return "LOSS";

    case "OVER_1_5":
      if (total > 1.5) return "WIN";
      return "LOSS";

    case "OVER_2_5":
      if (total > 2.5) return "WIN";
      return "LOSS";

    // Per ENGINE_SPEC: BTTS is not a supported market

    default:
      return "VOID";
  }
}

/**
 * Initialize empty stats aggregate
 */
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

/**
 * Update stats aggregate with an outcome
 */
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
  const category = outcome.prediction.category.toLowerCase() as "banker" | "value" | "risky";
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
 * Settle a single match - called when a match finishes
 * Returns settlement result or null if match cannot be settled
 */
export async function settleMatch(fixtureId: number): Promise<{
  settled: boolean;
  result?: OutcomeResult;
  alreadySettled?: boolean;
}> {
  const fixture = await getFixture(fixtureId);
  if (!fixture || fixture.status !== "FINISHED") {
    return { settled: false };
  }

  const prediction = await getPrediction(fixtureId);
  if (!prediction?.primaryMarket) {
    return { settled: false };
  }

  // Check if already settled (avoid duplicates)
  const today = getTodayGMT1();
  const yearMonth = formatYearMonthGMT1(new Date());
  const existingHistory = await getMonthlyHistory(yearMonth);
  const alreadySettled = existingHistory?.some(
    (o) => o.fixtureId === fixtureId
  );

  if (alreadySettled) {
    return { settled: false, alreadySettled: true };
  }

  // Fetch final score from API
  const finalScore = await fetchFinalScore(fixtureId);
  if (!finalScore) {
    return { settled: false };
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
  let stats = await getStats();
  if (!stats) {
    stats = initializeStats();
  }
  updateStats(stats, outcome, result);
  await setStats(stats);

  console.log(
    `[Settlement] Auto-settled ${fixture.homeTeam.shortName} vs ${fixture.awayTeam.shortName}: ${result} (${finalScore.home}-${finalScore.away})`
  );

  return { settled: true, result };
}
