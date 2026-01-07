/**
 * Prediction Generator
 * Combines sentiment + AI analysis to produce final predictions
 * Classification is deterministic + AI-informed
 */

import {
  BANKER_PROBABILITY_THRESHOLD,
  VALUE_PROBABILITY_MIN,
} from "@/config/constants";
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

  // No market data cases - rely solely on AI
  if (!hasMarketData) {
    if (aiConfidence === "HIGH" && aiProb >= 0.65 && geminiVerification.passed) {
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
  // - Gemini verification passed
  if (
    topOutcome.probability >= 0.65 &&
    alignment >= 0 &&
    aiProb >= 0.60 &&
    volume >= 500 &&
    geminiVerification.passed
  ) {
    return "BANKER";
  }

  // BANKER with even stronger AI conviction
  if (
    aiProb >= 0.70 &&
    alignment === 1 && // AI agrees with market leader
    aiConfidence === "HIGH" &&
    geminiVerification.passed
  ) {
    return "BANKER";
  }

  // VALUE: AI sees positive edge over market (>5% edge)
  if (hasEdge && edgePercent >= 5) {
    // AI thinks this outcome is undervalued by market
    if (aiConfidence !== "LOW" && geminiVerification.passed) {
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
 * Generate disclaimers based on analysis
 * For RISKY picks, these become the "Why Risky?" reasons
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
    if (!analysis.geminiVerification.passed) {
      disclaimers.push("Verification flagged potential issues with analysis.");
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

    case "BTTS":
      if (selection === "Yes" && home > 0 && away > 0) return "WIN";
      if (selection === "No" && (home === 0 || away === 0)) return "WIN";
      return "LOSS";

    default:
      return "VOID";
  }
}
