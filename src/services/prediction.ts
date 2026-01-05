/**
 * Prediction Generator
 * Combines sentiment + AI analysis to produce final predictions
 * Classification is deterministic + AI-informed
 */

import {
  BANKER_PROBABILITY_THRESHOLD,
  VALUE_PROBABILITY_MIN,
  VALUE_PROBABILITY_MAX,
  DISCLAIMER,
} from "@/config/constants";
import { MARKETS, type MarketType } from "@/config/markets";
import { nowGMT1 } from "@/lib/date";
import type {
  Fixture,
  MarketSentiment,
  AIAnalysis,
  Prediction,
  PredictionCategory,
  MarketSelection,
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
 * Determine prediction category based on rules
 */
function classifyPrediction(
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): PredictionCategory {
  const topOutcome = getTopOutcome(sentiment);
  const volume = getMarketVolume(sentiment);
  const hasMarketData = sentiment?.available && topOutcome;

  // BANKER requirements:
  // - Polymarket probability >= 70%
  // - Adequate volume (> $1000)
  // - Gemini verification passed
  // - AI confidence not LOW
  if (
    hasMarketData &&
    topOutcome.probability >= BANKER_PROBABILITY_THRESHOLD &&
    volume >= 1000 &&
    analysis.geminiVerification.passed &&
    analysis.groqAnalysis.confidence !== "LOW"
  ) {
    return "BANKER";
  }

  // VALUE requirements:
  // - Polymarket probability 40-60%
  // - AI has a suggested outcome
  // - AI confidence not LOW
  if (
    hasMarketData &&
    topOutcome.probability >= VALUE_PROBABILITY_MIN &&
    topOutcome.probability <= VALUE_PROBABILITY_MAX &&
    analysis.groqAnalysis.suggestedOutcome &&
    analysis.groqAnalysis.confidence !== "LOW"
  ) {
    return "VALUE";
  }

  // NO_BET for everything else
  return "NO_BET";
}

/**
 * Build primary market selection
 */
function buildPrimaryMarket(
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis,
  category: PredictionCategory
): MarketSelection | null {
  if (category === "NO_BET") return null;

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

  // Fallback to match result top outcome
  const topOutcome = getTopOutcome(sentiment);
  if (topOutcome) {
    return {
      type: "MATCH_RESULT",
      selection: topOutcome.name,
      confidence: Math.round(topOutcome.probability * 100),
      reasoning: groqAnalysis.narrative.split(".")[0] + ".",
    };
  }

  return null;
}

/**
 * Build alternative (safer) market selection
 */
function buildAlternativeMarket(
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis,
  primaryMarket: MarketSelection | null
): MarketSelection | null {
  if (!primaryMarket || primaryMarket.type !== "MATCH_RESULT") return null;

  const { groqAnalysis } = analysis;

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
 * Generate disclaimers based on analysis
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

  // Add Gemini flags
  if (analysis.geminiVerification.overconfidenceFlags.length > 0) {
    disclaimers.push("Analysis may overstate confidence.");
  }

  if (analysis.geminiVerification.missingContext.length > 0) {
    disclaimers.push("Some contextual factors may be missing.");
  }

  // Category-specific
  if (category === "VALUE") {
    disclaimers.push("Value play - higher risk, potential mispricing.");
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
  const disclaimers = generateDisclaimers(analysis, category);

  return {
    fixtureId: fixture.id,
    generatedAt: nowGMT1(),
    category,
    primaryMarket,
    alternativeMarket,
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

    default:
      return "VOID";
  }
}
