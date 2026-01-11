/**
 * Engine Scoring Module
 * Per ENGINE_SPEC.md: Deterministic, rule-based scoring
 *
 * AI models do NOT make decisions - they provide signals only.
 * Final decisions are made by this code.
 */

import type {
  Fixture,
  MarketSentiment,
  AIAnalysis,
  GeminiVerification,
  Prediction,
  PredictionCategory,
  MarketSelection,
} from "@/types";
import type { MarketType } from "@/config/markets";
import { nowGMT1 } from "@/lib/date";

// ============================================================================
// ENGINE CONSTANTS (Tunable)
// ============================================================================

/**
 * Gemini penalty values per ENGINE_SPEC
 */
const GEMINI_PENALTIES = {
  OVERCONFIDENCE: -10,
  MISSING_CONTEXT: -15,
  CAUTION_MILD: -5,
  CAUTION_STRONG: -20,
} as const;

/**
 * Market risk weights per ENGINE_SPEC
 * Lower = safer, Higher = riskier
 * Over 1.5 < Double Chance < Over 2.5 < Match Result
 */
const MARKET_RISK_WEIGHT: Record<MarketType, number> = {
  OVER_1_5: 1,       // Lowest variance
  DOUBLE_CHANCE: 2,
  OVER_2_5: 3,
  MATCH_RESULT: 4,   // Highest variance
};

/**
 * Minimum score threshold for a valid bet
 * If highest market score < this, NO BET
 */
const MIN_SCORE_THRESHOLD = 40;

/**
 * Alternative pick margin
 * Alternative must be within this margin of primary
 */
const ALTERNATIVE_MARGIN = 15;

/**
 * Volume thresholds for market confidence
 */
const VOLUME_THRESHOLDS = {
  HIGH: 10000,   // High liquidity
  MODERATE: 1000, // Moderate liquidity
  LOW: 100,      // Low liquidity
} as const;

/**
 * Daily bet cap per ENGINE_SPEC
 */
export const DAILY_BET_CAP = 5;

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

interface MarketScore {
  market: MarketType;
  selection: string;
  baseScore: number;
  volumeBonus: number;
  riskPenalty: number;
  geminiPenalty: number;
  finalScore: number;
  aiProbability: number;
  marketProbability: number | null;
  reasoning: string;
}

/**
 * Calculate Gemini penalty from verification flags
 * Per ENGINE_SPEC: Uses overconfidence, missingContext, cautionLevel
 */
function calculateGeminiPenalty(verification: GeminiVerification): number {
  let penalty = 0;

  // Overconfidence penalty
  if (verification.overconfidence) {
    penalty += GEMINI_PENALTIES.OVERCONFIDENCE;
  }

  // Missing context penalty
  if (verification.missingContext) {
    penalty += GEMINI_PENALTIES.MISSING_CONTEXT;
  }

  // Caution level penalty
  switch (verification.cautionLevel) {
    case "mild":
      penalty += GEMINI_PENALTIES.CAUTION_MILD;
      break;
    case "strong":
      penalty += GEMINI_PENALTIES.CAUTION_STRONG;
      break;
    // "none" = no penalty
  }

  return penalty;
}

/**
 * Calculate volume bonus based on market liquidity
 */
function calculateVolumeBonus(volume: number): number {
  if (volume >= VOLUME_THRESHOLDS.HIGH) return 10;
  if (volume >= VOLUME_THRESHOLDS.MODERATE) return 5;
  if (volume >= VOLUME_THRESHOLDS.LOW) return 2;
  return 0;
}

/**
 * Calculate risk penalty based on market type
 * Higher variance markets get penalized
 */
function calculateRiskPenalty(marketType: MarketType): number {
  return MARKET_RISK_WEIGHT[marketType] * -2; // -2 per risk level
}

/**
 * Score a single market
 */
function scoreMarket(
  marketType: MarketType,
  selection: string,
  aiProbability: number,
  marketProbability: number | null,
  volume: number,
  geminiPenalty: number,
  reasoning: string
): MarketScore {
  // Base score from AI probability (0-100)
  const baseScore = Math.round(aiProbability * 100);

  // Volume bonus
  const volumeBonus = calculateVolumeBonus(volume);

  // Risk penalty based on market variance
  const riskPenalty = calculateRiskPenalty(marketType);

  // Final score
  const finalScore = baseScore + volumeBonus + riskPenalty + geminiPenalty;

  return {
    market: marketType,
    selection,
    baseScore,
    volumeBonus,
    riskPenalty,
    geminiPenalty,
    finalScore,
    aiProbability,
    marketProbability,
    reasoning,
  };
}

/**
 * Get AI probability for a specific market/selection
 */
function getAIProbability(
  analysis: AIAnalysis,
  marketType: MarketType,
  selection: string
): number {
  const probs = analysis.groqAnalysis.probabilities;
  if (!probs) return 0.5;

  const selLower = selection.toLowerCase();

  switch (marketType) {
    case "MATCH_RESULT":
      if (selLower.includes("home")) return probs.homeWin;
      if (selLower.includes("away")) return probs.awayWin;
      if (selLower.includes("draw")) return probs.draw;
      break;

    case "DOUBLE_CHANCE":
      if (selLower === "1x") return probs.homeWin + probs.draw;
      if (selLower === "x2") return probs.awayWin + probs.draw;
      if (selLower === "12") return probs.homeWin + probs.awayWin;
      break;

    case "OVER_1_5":
      return probs.over15;

    case "OVER_2_5":
      return probs.over25;
  }

  return 0.5;
}

/**
 * Get market probability from sentiment
 */
function getMarketProbability(
  sentiment: MarketSentiment | null,
  marketType: MarketType,
  selection: string
): { probability: number | null; volume: number } {
  if (!sentiment?.available) {
    return { probability: null, volume: 0 };
  }

  const market = sentiment.markets.find((m) => m.type === marketType);
  if (!market) {
    return { probability: null, volume: 0 };
  }

  const selLower = selection.toLowerCase();
  const outcome = market.outcomes.find((o) => {
    const nameLower = o.name.toLowerCase();
    return (
      nameLower.includes(selLower) ||
      selLower.includes(nameLower) ||
      (selLower.includes("home") && nameLower.includes("home")) ||
      (selLower.includes("away") && nameLower.includes("away")) ||
      (selLower.includes("draw") && nameLower.includes("draw"))
    );
  });

  return {
    probability: outcome?.probability ?? null,
    volume: market.volume,
  };
}

/**
 * Score all markets for a fixture
 * Returns markets sorted by final score (highest first)
 */
export function scoreAllMarkets(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): MarketScore[] {
  const geminiPenalty = calculateGeminiPenalty(analysis.geminiVerification);
  const probs = analysis.groqAnalysis.probabilities;
  const scores: MarketScore[] = [];

  if (!probs) {
    return scores;
  }

  // Helper to add a market score
  const addMarketScore = (
    marketType: MarketType,
    selection: string,
    reasoning: string
  ) => {
    const aiProb = getAIProbability(analysis, marketType, selection);
    const { probability: marketProb, volume } = getMarketProbability(
      sentiment,
      marketType,
      selection
    );

    scores.push(
      scoreMarket(
        marketType,
        selection,
        aiProb,
        marketProb,
        volume,
        geminiPenalty,
        reasoning
      )
    );
  };

  // Match Result options
  const homeTeam = fixture.homeTeam.shortName;
  const awayTeam = fixture.awayTeam.shortName;

  addMarketScore(
    "MATCH_RESULT",
    "Home Win",
    `${homeTeam} to win at home`
  );
  addMarketScore(
    "MATCH_RESULT",
    "Away Win",
    `${awayTeam} to win away`
  );
  addMarketScore(
    "MATCH_RESULT",
    "Draw",
    "Match to end in a draw"
  );

  // Double Chance options
  addMarketScore(
    "DOUBLE_CHANCE",
    "1X",
    `${homeTeam} win or draw`
  );
  addMarketScore(
    "DOUBLE_CHANCE",
    "X2",
    `${awayTeam} win or draw`
  );

  // Goals markets
  addMarketScore(
    "OVER_1_5",
    "Over 1.5",
    "At least 2 goals in the match"
  );
  addMarketScore(
    "OVER_2_5",
    "Over 2.5",
    "At least 3 goals in the match"
  );

  // Sort by final score descending
  return scores.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Determine category based on score and confidence
 * Per ENGINE_SPEC: Uses Gemini flags for risk assessment
 */
function determineCategory(
  topScore: MarketScore,
  analysis: AIAnalysis
): PredictionCategory {
  const { finalScore } = topScore;
  const { overconfidence, cautionLevel } = analysis.geminiVerification;
  const aiConfidence = analysis.groqAnalysis.confidence;

  // Strong caution from Gemini = cap at VALUE
  if (cautionLevel === "strong") {
    return finalScore >= MIN_SCORE_THRESHOLD ? "VALUE" : "RISKY";
  }

  // BANKER: High score, no overconfidence, no strong caution, AI confident
  if (
    finalScore >= 65 &&
    !overconfidence &&
    aiConfidence === "HIGH" &&
    cautionLevel !== "mild"
  ) {
    return "BANKER";
  }

  // BANKER: Very high score even with medium confidence
  if (finalScore >= 75 && !overconfidence && cautionLevel === "none") {
    return "BANKER";
  }

  // VALUE: Moderate score with good confidence
  if (finalScore >= 50 && aiConfidence !== "LOW") {
    return "VALUE";
  }

  // VALUE: Just above threshold
  if (finalScore >= MIN_SCORE_THRESHOLD) {
    return "VALUE";
  }

  // RISKY: Below threshold
  return "RISKY";
}

/**
 * Build MarketSelection from MarketScore
 */
function buildMarketSelection(score: MarketScore): MarketSelection {
  return {
    type: score.market,
    selection: score.selection,
    confidence: Math.max(0, Math.min(100, score.finalScore)),
    reasoning: score.reasoning,
  };
}

/**
 * Generate disclaimers based on analysis and category
 * Per ENGINE_SPEC: Output a 1 sentence risk note from Gemini concern
 */
function generateDisclaimers(
  analysis: AIAnalysis,
  category: PredictionCategory,
  topScore: MarketScore
): string[] {
  const disclaimers: string[] = [];
  const { groqAnalysis, geminiVerification } = analysis;

  // AI concerns (from Groq)
  if (groqAnalysis.concerns.length > 0) {
    disclaimers.push(...groqAnalysis.concerns.slice(0, 2));
  }

  // Gemini risk flags per ENGINE_SPEC
  if (geminiVerification.overconfidence) {
    disclaimers.push(
      geminiVerification.overconfidenceReason ||
        "Analysis may overstate confidence."
    );
  }
  if (geminiVerification.missingContext) {
    disclaimers.push(
      geminiVerification.missingContextReason ||
        "Some context may be missing from analysis."
    );
  }
  if (geminiVerification.cautionLevel === "strong") {
    disclaimers.push("Strong caution advised - significant risk factors.");
  } else if (geminiVerification.cautionLevel === "mild") {
    disclaimers.push("Some concerns noted in risk review.");
  }

  // Category-specific
  if (category === "VALUE") {
    disclaimers.push("Value play - potential mispricing identified.");
  }

  if (category === "RISKY") {
    if (topScore.finalScore < MIN_SCORE_THRESHOLD) {
      disclaimers.push(`Score ${topScore.finalScore} below threshold.`);
    }
    if (groqAnalysis.confidence === "LOW") {
      disclaimers.push("AI confidence is low.");
    }
  }

  // Ensure at least one disclaimer for RISKY
  if (category === "RISKY" && disclaimers.length === 0) {
    disclaimers.push("Conflicting signals in analysis.");
  }

  return disclaimers;
}

/**
 * Generate prediction using ENGINE_SPEC scoring model
 * This is the main entry point for the engine
 */
export function generateEnginePrediction(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): Prediction {
  // Score all markets
  const scores = scoreAllMarkets(fixture, sentiment, analysis);

  // If no scores (no probabilities), return RISKY with fallback
  if (scores.length === 0) {
    return {
      fixtureId: fixture.id,
      generatedAt: nowGMT1(),
      category: "RISKY",
      primaryMarket: {
        type: "MATCH_RESULT",
        selection: "Home Win",
        confidence: 30,
        reasoning: "Insufficient data for analysis.",
      },
      alternativeMarket: null,
      allMarkets: [],
      narrative: analysis.groqAnalysis.narrative || "Analysis unavailable.",
      keyFactors: analysis.groqAnalysis.keyFactors || [],
      disclaimers: ["Insufficient data - proceed with caution."],
    };
  }

  const topScore = scores[0];
  const category = determineCategory(topScore, analysis);
  const primaryMarket = buildMarketSelection(topScore);

  // Find alternative: second-highest, within margin, prefer lower variance
  let alternativeMarket: MarketSelection | null = null;
  for (let i = 1; i < scores.length; i++) {
    const candidate = scores[i];
    const scoreDiff = topScore.finalScore - candidate.finalScore;

    // Within margin and different market type
    if (
      scoreDiff <= ALTERNATIVE_MARGIN &&
      candidate.market !== topScore.market
    ) {
      // Prefer lower variance (lower risk weight)
      if (
        MARKET_RISK_WEIGHT[candidate.market] <
        MARKET_RISK_WEIGHT[topScore.market]
      ) {
        alternativeMarket = buildMarketSelection(candidate);
        break;
      }
    }
  }

  // If no lower-variance alternative, take any within margin
  if (!alternativeMarket) {
    for (let i = 1; i < scores.length; i++) {
      const candidate = scores[i];
      const scoreDiff = topScore.finalScore - candidate.finalScore;

      if (
        scoreDiff <= ALTERNATIVE_MARGIN &&
        candidate.market !== topScore.market
      ) {
        alternativeMarket = buildMarketSelection(candidate);
        break;
      }
    }
  }

  // Build all markets list (top 4 excluding primary)
  const allMarkets = scores
    .slice(1, 5)
    .map(buildMarketSelection);

  const disclaimers = generateDisclaimers(analysis, category, topScore);

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
 * Apply daily cap: keep top N predictions by score
 * Per ENGINE_SPEC: Max 5 bets per calendar day
 */
export function applyDailyCap(
  predictions: Array<{ fixture: Fixture; prediction: Prediction; topScore: number }>
): Array<{ fixture: Fixture; prediction: Prediction }> {
  // Sort by top score descending
  const sorted = [...predictions].sort((a, b) => b.topScore - a.topScore);

  // Keep only top N
  return sorted.slice(0, DAILY_BET_CAP).map(({ fixture, prediction }) => ({
    fixture,
    prediction,
  }));
}

/**
 * Filter out predictions below threshold
 * Per ENGINE_SPEC: If highest score < threshold → NO BET
 */
export function filterBelowThreshold(
  predictions: Array<{ fixture: Fixture; prediction: Prediction; topScore: number }>
): Array<{ fixture: Fixture; prediction: Prediction; topScore: number }> {
  return predictions.filter(({ topScore }) => topScore >= MIN_SCORE_THRESHOLD);
}
