/**
 * Engine Scoring Module - ENGINE_SPEC v1.1
 *
 * Deterministic, rule-based scoring.
 * AI models provide signals only - final decisions are made by this code.
 * Same inputs must always produce same outputs.
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
// ENGINE CONSTANTS (Per ENGINE_SPEC v1.1)
// ============================================================================

/**
 * Base Market Scores per ENGINE_SPEC v1.2
 * Expressive markets (ML, O2.5) get equal priority
 * Safe markets (DC, O1.5) are penalized to prevent over-selection
 */
const BASE_MARKET_SCORES: Record<MarketType, number> = {
  MATCH_RESULT: 50,     // Expressive - clear position
  DOUBLE_CHANCE: 48,    // Safe fallback - competitive with Draw (v1.6)
  OVER_1_5: 46,         // Safe fallback - can compete when ML penalized (v1.6)
  OVER_2_5: 50,         // Expressive - equal to ML
};

/**
 * Context-aware Gemini penalty values per ENGINE_SPEC v1.4
 * Penalties scale based on Groq's confidence level:
 * - HIGH confidence picks get full penalties (they claim certainty)
 * - MEDIUM confidence picks get moderate penalties
 * - LOW confidence picks get soft penalties (already flagged as risky)
 */
const GEMINI_PENALTIES_BY_CONFIDENCE = {
  HIGH: {
    CAUTION_MILD: -15,
    CAUTION_STRONG: -30,
    COMBINED_FLAGS: -10,
  },
  MEDIUM: {
    CAUTION_MILD: -10,
    CAUTION_STRONG: -20,
    COMBINED_FLAGS: -5,
  },
  LOW: {
    CAUTION_MILD: -5,
    CAUTION_STRONG: -10,
    COMBINED_FLAGS: 0,  // No stacking for already-risky picks
  },
} as const;

/**
 * Polymarket signal bonuses/penalties per ENGINE_SPEC v1.1
 * v1.3: Alignment bonus now requires minimum probability to prevent Draw bias
 */
const POLYMARKET_SIGNALS = {
  VOLUME_BONUS: 10,         // +10 if volume >= threshold
  ALIGNMENT_BONUS: 10,      // +10 if probability aligns with Groq lean
  LOW_PAYOUT_PENALTY: -10,  // -10 if extremely low payout proxy (e.g. DC at ~1.04 implied)
  VOLUME_THRESHOLD: 1000,   // Minimum volume for bonus
  LOW_PAYOUT_THRESHOLD: 0.96, // 96%+ implied probability = low payout
  ALIGNMENT_MIN_PROB: 0.35, // v1.3: Alignment bonus only if prob >= 35%
} as const;

/**
 * Groq confidence scoring per ENGINE_SPEC v1.1
 * Linear scale from Groq output (max +20)
 */
const GROQ_CONFIDENCE = {
  HIGH: 20,
  MEDIUM: 10,
  LOW: 0,
} as const;

/**
 * Category thresholds per ENGINE_SPEC v1.1
 */
const CATEGORY_THRESHOLDS = {
  BANKER: 70,   // >= 70 AND no strong Gemini caution
  VALUE_MIN: 55,
  VALUE_MAX: 69,
  RISKY_MIN: 40,
  RISKY_MAX: 54,
  NO_BET: 40,   // < 40
} as const;

/**
 * Market usefulness ceilings per ENGINE_SPEC v1.1
 * Over 1.5 and Double Chance cannot be PRIMARY above these thresholds
 * These are hard constraints enforced before scoring and selection
 */
const USEFULNESS_CEILINGS = {
  OVER_1_5: 0.78,      // Cannot be PRIMARY if AI probability > 78%
  DOUBLE_CHANCE: 0.75, // Cannot be PRIMARY if AI probability > 75%
  ML_THRESHOLD: 0.68,  // Only apply ceilings when ML favorite prob >= 68% (v1.6)
} as const;

/**
 * Draw market safeguards per ENGINE_SPEC v1.2
 * DRAW cannot be PRIMARY under certain conditions
 */
const DRAW_SAFEGUARDS = {
  MIN_DRAW_PROBABILITY: 0.15,   // Draw cannot be PRIMARY if market prob < 15%
  MAX_FAVORITE_PROBABILITY: 0.65, // Draw cannot be PRIMARY if favorite > 65%
} as const;

/**
 * ML low-probability safeguard per ENGINE_SPEC v1.6
 * Penalize ML picks when probability is too low to justify the risk
 */
const ML_LOW_PROB_SAFEGUARD = {
  THRESHOLD: 0.55,  // Apply penalty if ML prob < 55% (v1.6)
  PENALTY: -8,      // Reduce score by 8 points
} as const;

/**
 * Confidence sanity check per ENGINE_SPEC v1.2
 * Cap at VALUE if AI diverges significantly from market AND Gemini has concerns
 */
const CONFIDENCE_SANITY = {
  MAX_DIVERGENCE: 0.25, // 25% divergence threshold
} as const;

/**
 * Dominance override thresholds per ENGINE_SPEC v1.2
 * Lowered thresholds to trigger more often and boost expressive markets
 */
const DOMINANCE_OVERRIDE = {
  FAVORITE_MIN_PROB: 0.60,  // Was 0.70 - now triggers for clearer favorites
  UNDERDOG_MAX_PROB: 0.25,  // Was 0.20 - slightly relaxed
  VOLUME_THRESHOLD: 500,    // Was 1000 - lower barrier
} as const;

/**
 * Dominance score adjustments per ENGINE_SPEC v1.6
 * Unipolar: boost expressive markets only, no penalty for safe markets
 */
const DOMINANCE_ADJUSTMENTS = {
  EXPRESSIVE_BOOST: 8,   // +8 for ML and Over 2.5 (was +12)
  SAFE_PENALTY: 0,       // No penalty for DC and Over 1.5 (was -12)
} as const;

/**
 * Correlated market pairs - PRIMARY and SECONDARY must be uncorrelated
 * These pairs are forbidden together per ENGINE_SPEC v1.1
 */
const CORRELATED_MARKETS: Array<[MarketType, MarketType]> = [
  ["MATCH_RESULT", "DOUBLE_CHANCE"],  // ML + DC forbidden
  ["OVER_1_5", "DOUBLE_CHANCE"],      // O1.5 + DC forbidden (both are safety nets)
  ["OVER_1_5", "OVER_2_5"],           // O1.5 + O2.5 forbidden (strongly correlated)
];

/**
 * Minimum score threshold for a valid bet
 */
const MIN_SCORE_THRESHOLD = 40;

/**
 * Alternative pick margin - must be within this of primary
 */
const ALTERNATIVE_MARGIN = 15;

/**
 * Daily bet cap per ENGINE_SPEC
 */
export const DAILY_BET_CAP = 5;

// ============================================================================
// SCORING TYPES
// ============================================================================

interface MarketScore {
  market: MarketType;
  selection: string;
  baseScore: number;
  polymarketSignal: number;
  groqConfidenceBonus: number;
  geminiPenalty: number;
  finalScore: number;
  aiProbability: number;
  marketProbability: number | null;
  reasoning: string;
  // Constraint flags
  blockedAsPrimary: boolean;
  blockReason: string | null;
}

// ============================================================================
// CONSTRAINT FUNCTIONS (Applied FIRST per ENGINE_SPEC v1.1)
// ============================================================================

/**
 * Check if market is blocked from being PRIMARY due to usefulness ceiling
 * v1.6: Only apply ceilings when ML favorite probability >= 68%
 * When ML is not dominant, high-prob DC/O1.5 are actually good picks
 */
function isBlockedByUsefulnessCeiling(
  marketType: MarketType,
  aiProbability: number,
  favoriteProb: number = 0
): { blocked: boolean; reason: string | null } {
  // v1.6: Only apply ceilings when ML is solid favorite (>=68%)
  // When ML is risky (<68%), high-prob DC/O1.5 should be allowed
  if (favoriteProb < USEFULNESS_CEILINGS.ML_THRESHOLD) {
    return { blocked: false, reason: null };
  }

  if (marketType === "OVER_1_5" && aiProbability > USEFULNESS_CEILINGS.OVER_1_5) {
    return {
      blocked: true,
      reason: `Over 1.5 at ${Math.round(aiProbability * 100)}% is too safe for PRIMARY (ML at ${Math.round(favoriteProb * 100)}%)`,
    };
  }
  if (marketType === "DOUBLE_CHANCE" && aiProbability > USEFULNESS_CEILINGS.DOUBLE_CHANCE) {
    return {
      blocked: true,
      reason: `Double Chance at ${Math.round(aiProbability * 100)}% is too safe for PRIMARY (ML at ${Math.round(favoriteProb * 100)}%)`,
    };
  }
  return { blocked: false, reason: null };
}

/**
 * Check if DRAW selection is blocked from being PRIMARY per ENGINE_SPEC v1.2
 * DRAW cannot be PRIMARY if:
 * - Market probability < 15%
 * - OR favorite win prob > 65%
 */
function isDrawBlockedAsPrimary(
  selection: string,
  drawProbability: number,
  favoriteProb: number
): { blocked: boolean; reason: string | null } {
  // Only applies to Draw selections
  if (!selection.toLowerCase().includes("draw")) {
    return { blocked: false, reason: null };
  }

  // Block if draw probability is too low
  if (drawProbability < DRAW_SAFEGUARDS.MIN_DRAW_PROBABILITY) {
    return {
      blocked: true,
      reason: `Draw at ${Math.round(drawProbability * 100)}% is too unlikely for PRIMARY`,
    };
  }

  // Block if there's a strong favorite
  if (favoriteProb > DRAW_SAFEGUARDS.MAX_FAVORITE_PROBABILITY) {
    return {
      blocked: true,
      reason: `Strong favorite (${Math.round(favoriteProb * 100)}%) makes Draw risky as PRIMARY`,
    };
  }

  return { blocked: false, reason: null };
}

/**
 * Check if two markets are correlated (forbidden as PRIMARY + SECONDARY)
 */
function areMarketsCorrelated(market1: MarketType, market2: MarketType): boolean {
  return CORRELATED_MARKETS.some(
    ([a, b]) => (market1 === a && market2 === b) || (market1 === b && market2 === a)
  );
}

// ============================================================================
// SCORING FUNCTIONS (Applied SECOND per ENGINE_SPEC v1.1)
// ============================================================================

/**
 * Calculate Groq confidence bonus (max +20, linear scale)
 */
function calculateGroqConfidenceBonus(confidence: "HIGH" | "MEDIUM" | "LOW"): number {
  return GROQ_CONFIDENCE[confidence] ?? 0;
}

/**
 * Calculate Polymarket signal per ENGINE_SPEC v1.1
 * +10 if volume >= threshold
 * +10 if probability aligns with Groq lean
 * -10 if market is extremely low payout proxy
 *
 * v1.3: Alignment bonus now requires minimum probability (35%) to prevent Draw bias
 * Low-probability outcomes (like Draw at 20%) shouldn't get alignment bonuses
 * just because they happen to match the AI's conservative estimate.
 */
function calculatePolymarketSignal(
  volume: number,
  marketProbability: number | null,
  aiProbability: number,
  marketType: MarketType
): number {
  let signal = 0;

  // +10 if volume >= threshold
  if (volume >= POLYMARKET_SIGNALS.VOLUME_THRESHOLD) {
    signal += POLYMARKET_SIGNALS.VOLUME_BONUS;
  }

  // +10 if probability aligns with Groq lean (within 15% of each other)
  // v1.3: Only apply if the outcome has meaningful probability (>= 35%)
  // This prevents Draw from getting alignment bonuses when it's a low-probability outcome
  if (marketProbability !== null) {
    const alignment = Math.abs(aiProbability - marketProbability);
    const hasMeaningfulProbability =
      aiProbability >= POLYMARKET_SIGNALS.ALIGNMENT_MIN_PROB ||
      marketProbability >= POLYMARKET_SIGNALS.ALIGNMENT_MIN_PROB;

    if (alignment <= 0.15 && hasMeaningfulProbability) {
      signal += POLYMARKET_SIGNALS.ALIGNMENT_BONUS;
    }
  }

  // -10 if extremely low payout proxy (DC or O1.5 at 96%+)
  if (
    (marketType === "DOUBLE_CHANCE" || marketType === "OVER_1_5") &&
    aiProbability >= POLYMARKET_SIGNALS.LOW_PAYOUT_THRESHOLD
  ) {
    signal += POLYMARKET_SIGNALS.LOW_PAYOUT_PENALTY;
  }

  return signal;
}

/**
 * Calculate Gemini penalty from verification flags per ENGINE_SPEC v1.4
 * Penalties now scale based on Groq's confidence level:
 * - HIGH confidence picks get full penalties (they claim certainty)
 * - MEDIUM confidence picks get moderate penalties
 * - LOW confidence picks get soft penalties (already flagged as risky)
 */
function calculateGeminiPenalty(
  verification: GeminiVerification,
  groqConfidence: "HIGH" | "MEDIUM" | "LOW"
): number {
  const penalties = GEMINI_PENALTIES_BY_CONFIDENCE[groqConfidence];
  let penalty = 0;

  // Caution level penalty (scaled by confidence)
  switch (verification.cautionLevel) {
    case "mild":
      penalty += penalties.CAUTION_MILD;
      break;
    case "strong":
      penalty += penalties.CAUTION_STRONG;
      break;
  }

  // Additional penalty if BOTH overconfidence AND missingContext
  if (verification.overconfidence && verification.missingContext) {
    penalty += penalties.COMBINED_FLAGS;
  }

  return penalty;
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
 * Get market probability from Polymarket sentiment
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

  // Handle Over/Under markets - Polymarket uses "Yes"/"No"
  if (marketType === "OVER_2_5" || marketType === "OVER_1_5") {
    const isOverSelection = selLower.includes("over");
    let outcome = market.outcomes.find(
      (o) => o.name.toLowerCase() === (isOverSelection ? "yes" : "no")
    );
    if (!outcome) {
      outcome = market.outcomes.find(
        (o) => o.name.toLowerCase().includes(isOverSelection ? "over" : "under")
      );
    }
    return {
      probability: outcome?.probability ?? null,
      volume: market.volume,
    };
  }

  // Standard matching
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
 * Probability bonus for higher-confidence selections (v1.3)
 * Adds small tiebreaker bonus based on actual probability
 * Range: 0-8 points based on probability (50%+ gets proportional bonus)
 */
function calculateProbabilityBonus(
  aiProbability: number,
  marketProbability: number | null
): number {
  // Use market probability if available (more reliable), otherwise AI
  const prob = marketProbability ?? aiProbability;

  // Only give bonus for probabilities above 40%
  if (prob < 0.40) return 0;

  // Scale: 40% = 0, 70% = 8 (linear scale)
  // This gives higher-probability outcomes a tiebreaker advantage
  return Math.min(8, Math.round((prob - 0.40) * (8 / 0.30)));
}

/**
 * AI/Market divergence signal per ENGINE_SPEC v1.4
 * Rewards AI for finding value edges, penalizes going against strong market consensus
 * Returns 0 when no Polymarket data (neutral - no penalty for missing PM)
 */
function calculateDivergenceSignal(
  aiProbability: number,
  marketProbability: number | null,
  groqConfidence: "HIGH" | "MEDIUM" | "LOW"
): number {
  // NO POLYMARKET DATA = no divergence signal (neutral, not penalized)
  if (marketProbability === null) return 0;

  const divergence = aiProbability - marketProbability; // Positive = AI more confident

  // If AI sees VALUE (higher than market) and confidence is HIGH
  // This rewards the AI for finding edges the market missed
  if (divergence > 0.10 && groqConfidence === "HIGH") {
    return 5; // Bonus for finding edge
  }

  // If AI much lower than market (AI sees risk market doesn't)
  // Penalize going against strong market consensus
  if (divergence < -0.15) {
    return -5; // Penalty for going against strong market
  }

  return 0;
}

/**
 * Score a single market per ENGINE_SPEC v1.4 formula:
 * finalScore = base + polymarketSignal + groqConfidence + geminiPenalty + probabilityBonus + divergenceSignal
 *
 * v1.2: Added favoriteProb for Draw safeguard checks
 * v1.3: Added probability bonus as tiebreaker for higher-probability outcomes
 * v1.4: Added divergence signal for AI/Market alignment, context-aware Gemini penalties
 */
function scoreMarket(
  marketType: MarketType,
  selection: string,
  aiProbability: number,
  marketProbability: number | null,
  volume: number,
  groqConfidence: "HIGH" | "MEDIUM" | "LOW",
  geminiPenalty: number,
  reasoning: string,
  favoriteProb: number = 0 // For Draw safeguard check
): MarketScore {
  // Base score from ENGINE_SPEC v1.1 (fixed per market type)
  const baseScore = BASE_MARKET_SCORES[marketType];

  // Polymarket signal (+10 volume, +10 alignment, -10 low payout)
  const polymarketSignal = calculatePolymarketSignal(
    volume,
    marketProbability,
    aiProbability,
    marketType
  );

  // Groq confidence bonus (max +20)
  const groqConfidenceBonus = calculateGroqConfidenceBonus(groqConfidence);

  // v1.3: Probability bonus for tiebreaking (max +8)
  const probabilityBonus = calculateProbabilityBonus(aiProbability, marketProbability);

  // v1.4: Divergence signal - rewards AI for finding edges, penalizes going against market
  // Returns 0 when no PM data (no penalty for missing Polymarket)
  const divergenceSignal = calculateDivergenceSignal(aiProbability, marketProbability, groqConfidence);

  // v1.6: ML low-probability penalty - penalize ML picks when probability is too low
  // Don't apply to Draw (already has separate safeguards)
  let mlLowProbPenalty = 0;
  if (marketType === "MATCH_RESULT" && aiProbability < ML_LOW_PROB_SAFEGUARD.THRESHOLD) {
    const isDrawSelection = selection.toLowerCase().includes("draw");
    if (!isDrawSelection) {
      mlLowProbPenalty = ML_LOW_PROB_SAFEGUARD.PENALTY;
    }
  }

  // Final score per ENGINE_SPEC v1.6
  const finalScore = baseScore + polymarketSignal + groqConfidenceBonus + geminiPenalty + probabilityBonus + divergenceSignal + mlLowProbPenalty;

  // Check usefulness ceiling constraint (v1.6: conditional on ML favorite prob)
  const usefulnessCheck = isBlockedByUsefulnessCeiling(marketType, aiProbability, favoriteProb);

  // Check Draw safeguard constraint (v1.2)
  const drawCheck = isDrawBlockedAsPrimary(selection, aiProbability, favoriteProb);

  // Combine constraints - blocked if EITHER applies
  const blocked = usefulnessCheck.blocked || drawCheck.blocked;
  const reason = usefulnessCheck.reason || drawCheck.reason;

  return {
    market: marketType,
    selection,
    baseScore,
    polymarketSignal,
    groqConfidenceBonus,
    geminiPenalty,
    finalScore,
    aiProbability,
    marketProbability,
    reasoning,
    blockedAsPrimary: blocked,
    blockReason: reason,
  };
}

// ============================================================================
// DOMINANCE OVERRIDE (Applied THIRD per ENGINE_SPEC v1.1)
// ============================================================================

/**
 * Check if dominance override applies (Bayern-style games)
 * Per ENGINE_SPEC v1.1: If favorite >= 70%, underdog <= 20%, volume >= threshold
 * Then allow ML or Over 2.5 to outrank DC or Over 1.5
 *
 * BLOCKED when Gemini cautionLevel === "strong" (hard risk brake)
 */
function checkDominanceOverride(
  analysis: AIAnalysis,
  sentiment: MarketSentiment | null
): boolean {
  // Block dominance override when Gemini caution is STRONG
  if (analysis.geminiVerification.cautionLevel === "strong") {
    return false;
  }

  const probs = analysis.groqAnalysis.probabilities;
  if (!probs) return false;

  // Find favorite and underdog probabilities
  const homeProb = probs.homeWin;
  const awayProb = probs.awayWin;

  const favoriteProb = Math.max(homeProb, awayProb);
  const underdogProb = Math.min(homeProb, awayProb);

  // Check dominance conditions
  const isDominant =
    favoriteProb >= DOMINANCE_OVERRIDE.FAVORITE_MIN_PROB &&
    underdogProb <= DOMINANCE_OVERRIDE.UNDERDOG_MAX_PROB;

  if (!isDominant) return false;

  // Check volume threshold
  if (!sentiment?.available) return false;

  const totalVolume = sentiment.markets.reduce((sum, m) => sum + m.volume, 0);
  return totalVolume >= DOMINANCE_OVERRIDE.VOLUME_THRESHOLD;
}

/**
 * Apply dominance override to scores (bipolar adjustment)
 * Boosts expressive markets (ML, O2.5) and suppresses safe markets (DC, O1.5)
 * This actively overrides safety bias in dominant fixtures
 *
 * v1.2: Dominance override MUST NOT apply to DRAW selections
 */
function applyDominanceOverride(scores: MarketScore[], isDominant: boolean): MarketScore[] {
  if (!isDominant) return scores;

  return scores.map((score) => {
    // v1.2: NEVER boost Draw selections in dominance override
    const isDrawSelection = score.selection.toLowerCase().includes("draw");

    // Boost expressive markets (ML for non-Draw, O2.5)
    if (score.market === "MATCH_RESULT" && !isDrawSelection) {
      return {
        ...score,
        finalScore: score.finalScore + DOMINANCE_ADJUSTMENTS.EXPRESSIVE_BOOST,
      };
    }
    if (score.market === "OVER_2_5") {
      return {
        ...score,
        finalScore: score.finalScore + DOMINANCE_ADJUSTMENTS.EXPRESSIVE_BOOST,
      };
    }
    // Suppress ultra-safe markets
    if (score.market === "DOUBLE_CHANCE" || score.market === "OVER_1_5") {
      return {
        ...score,
        finalScore: score.finalScore + DOMINANCE_ADJUSTMENTS.SAFE_PENALTY,
      };
    }
    return score;
  });
}

// ============================================================================
// CATEGORY DETERMINATION (Per ENGINE_SPEC v1.1)
// ============================================================================

/**
 * Check confidence sanity per ENGINE_SPEC v1.2
 * Returns true if BANKER should be blocked due to divergence
 */
function shouldBlockBankerForDivergence(
  aiProbability: number,
  marketProbability: number | null,
  geminiVerification: GeminiVerification
): boolean {
  // Only applies when market probability is available
  if (marketProbability === null) return false;

  // Check divergence
  const divergence = Math.abs(aiProbability - marketProbability);

  // Block BANKER if divergence > 25% AND Gemini has concerns
  return (
    divergence > CONFIDENCE_SANITY.MAX_DIVERGENCE &&
    geminiVerification.cautionLevel !== "none"
  );
}

/**
 * Determine category based on final score per ENGINE_SPEC v1.1
 * - BANKER: >= 70 AND no strong Gemini caution
 * - VALUE: 55-69
 * - RISKY: 40-54
 * - NO BET: < 40
 *
 * v1.2: Added confidence sanity check - cap at VALUE if AI/Market diverge > 25% AND Gemini caution
 * v1.4: MATCH_RESULT Draw capped at VALUE (never BANKER) to prevent Draw drift
 */
function determineCategory(
  finalScore: number,
  geminiVerification: GeminiVerification,
  aiProbability: number = 0,
  marketProbability: number | null = null,
  selection?: string,
  marketType?: string
): PredictionCategory {
  // NO BET if below minimum threshold
  if (finalScore < CATEGORY_THRESHOLDS.NO_BET) {
    return "RISKY"; // We use RISKY to represent NO_BET in our type system
  }

  // v1.4: MATCH_RESULT Draw cannot be BANKER - max category is VALUE
  // Scoped to MATCH_RESULT only to avoid affecting goal markets or future markets
  const isMatchResultDraw =
    marketType === "MATCH_RESULT" &&
    selection?.toLowerCase().includes("draw");

  if (isMatchResultDraw) {
    // Draw can be VALUE at best, never BANKER
    if (finalScore >= CATEGORY_THRESHOLDS.VALUE_MIN) {
      return "VALUE";
    }
    return "RISKY";
  }

  // v1.2: Confidence sanity check - block BANKER if divergence is too high
  const blockBankerForDivergence = shouldBlockBankerForDivergence(
    aiProbability,
    marketProbability,
    geminiVerification
  );

  // BANKER: >= 70 AND no strong Gemini caution AND passes sanity check
  if (
    finalScore >= CATEGORY_THRESHOLDS.BANKER &&
    geminiVerification.cautionLevel !== "strong" &&
    !blockBankerForDivergence
  ) {
    return "BANKER";
  }

  // VALUE: 55-69 (or would-be BANKER blocked by sanity check)
  if (finalScore >= CATEGORY_THRESHOLDS.VALUE_MIN) {
    return "VALUE";
  }

  // RISKY: 40-54
  return "RISKY";
}

// ============================================================================
// MAIN ENGINE FUNCTIONS
// ============================================================================

/**
 * Score all markets for a fixture
 * Returns markets sorted by final score (highest first)
 */
export function scoreAllMarkets(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): MarketScore[] {
  const groqConfidence = analysis.groqAnalysis.confidence;
  // Context-aware penalties: scale based on Groq's confidence level
  const geminiPenalty = calculateGeminiPenalty(analysis.geminiVerification, groqConfidence);
  const probs = analysis.groqAnalysis.probabilities;
  const scores: MarketScore[] = [];

  if (!probs) {
    return scores;
  }

  // Calculate favorite probability for Draw safeguard (v1.2)
  // Use average of AI and market probability; fallback to AI only if no market data
  const homeMarketProb = getMarketProbability(sentiment, "MATCH_RESULT", "Home Win").probability;
  const awayMarketProb = getMarketProbability(sentiment, "MATCH_RESULT", "Away Win").probability;
  const homeProb = homeMarketProb !== null ? (probs.homeWin + homeMarketProb) / 2 : probs.homeWin;
  const awayProb = awayMarketProb !== null ? (probs.awayWin + awayMarketProb) / 2 : probs.awayWin;
  const favoriteProb = Math.max(homeProb, awayProb);

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
        groqConfidence,
        geminiPenalty,
        reasoning,
        favoriteProb // Pass for Draw safeguard check
      )
    );
  };

  // Build all market options
  const homeTeam = fixture.homeTeam.shortName;
  const awayTeam = fixture.awayTeam.shortName;

  // Match Result options
  addMarketScore("MATCH_RESULT", "Home Win", `${homeTeam} to win at home`);
  addMarketScore("MATCH_RESULT", "Away Win", `${awayTeam} to win away`);
  addMarketScore("MATCH_RESULT", "Draw", "Match to end in a draw");

  // Double Chance options
  addMarketScore("DOUBLE_CHANCE", "1X", `${homeTeam} win or draw`);
  addMarketScore("DOUBLE_CHANCE", "X2", `${awayTeam} win or draw`);

  // Goals markets
  addMarketScore("OVER_1_5", "Over 1.5", "At least 2 goals in the match");
  addMarketScore("OVER_2_5", "Over 2.5", "At least 3 goals in the match");

  // Check dominance override
  const isDominant = checkDominanceOverride(analysis, sentiment);

  // Apply dominance override (step 3)
  const adjustedScores = applyDominanceOverride(scores, isDominant);

  // Sort by final score descending
  return adjustedScores.sort((a, b) => b.finalScore - a.finalScore);
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
 * Boost applied to expressive markets when safe markets are blocked
 * This ensures ML and O2.5 are promoted when DC/O1.5 hit usefulness ceilings
 */
const EXPRESSIVE_BOOST_ON_SAFE_BLOCK = 4; // Was 6 - reduced per v1.6

/**
 * Select PRIMARY market applying constraints
 * Respects usefulness ceilings per ENGINE_SPEC v1.1
 * v1.2: Boosts expressive markets (ML, O2.5) when safe markets (DC, O1.5) are blocked
 */
function selectPrimaryMarket(scores: MarketScore[]): MarketScore | null {
  // Log top 5 scores for debugging
  console.log("[Engine] Top scores:");
  scores.slice(0, 5).forEach((s) => {
    console.log(`  ${s.market} ${s.selection}: ${s.finalScore} (base=${s.baseScore}, pm=${s.polymarketSignal}, ai=${s.groqConfidenceBonus}, gem=${s.geminiPenalty}, blocked=${s.blockedAsPrimary})`);
  });

  // Check if any safe market was blocked by usefulness ceiling
  const safeMarketsBlocked = scores.some(
    (s) => s.blockedAsPrimary && (s.market === "DOUBLE_CHANCE" || s.market === "OVER_1_5")
  );

  // If safe markets were blocked, create adjusted scores with expressive boost
  // v1.4: Exclude MATCH_RESULT Draw from boost (mirrors dominance override logic)
  let adjustedScores = scores;
  if (safeMarketsBlocked) {
    console.log("[Engine] Safe markets blocked, boosting expressive markets (excluding Draw)");
    adjustedScores = scores.map((s) => {
      const isMatchResultDraw = s.market === "MATCH_RESULT" && s.selection.toLowerCase().includes("draw");
      if ((s.market === "MATCH_RESULT" && !isMatchResultDraw) || s.market === "OVER_2_5") {
        return { ...s, finalScore: s.finalScore + EXPRESSIVE_BOOST_ON_SAFE_BLOCK };
      }
      return s;
    }).sort((a, b) => {
      // v1.4: Stable tiebreaker - demote MATCH_RESULT Draw on equal scores
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      const aIsMatchResultDraw = a.market === "MATCH_RESULT" && a.selection.toLowerCase().includes("draw") ? 1 : 0;
      const bIsMatchResultDraw = b.market === "MATCH_RESULT" && b.selection.toLowerCase().includes("draw") ? 1 : 0;
      return aIsMatchResultDraw - bIsMatchResultDraw;
    });
  }

  // Find highest scoring market that isn't blocked
  for (const score of adjustedScores) {
    if (!score.blockedAsPrimary) {
      console.log(`[Engine] Selected PRIMARY: ${score.market} ${score.selection} (score=${score.finalScore})`);
      return score;
    }
  }
  // If all are blocked (unlikely), take highest anyway
  return adjustedScores[0] || null;
}

/**
 * Select SECONDARY market applying correlation constraints
 * Must be uncorrelated with PRIMARY per ENGINE_SPEC v1.1
 */
function selectSecondaryMarket(
  scores: MarketScore[],
  primary: MarketScore
): MarketScore | null {
  for (let i = 1; i < scores.length; i++) {
    const candidate = scores[i];
    const scoreDiff = primary.finalScore - candidate.finalScore;

    // Must be within margin
    if (scoreDiff > ALTERNATIVE_MARGIN) continue;

    // Must be different market type
    if (candidate.market === primary.market) continue;

    // Must NOT be correlated with PRIMARY
    if (areMarketsCorrelated(primary.market, candidate.market)) continue;

    return candidate;
  }

  return null;
}

/**
 * Generate disclaimers based on analysis and category
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

  // Gemini risk flags
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

  // Usefulness ceiling warning
  if (topScore.blockReason) {
    disclaimers.push(topScore.blockReason);
  }

  // Ensure at least one disclaimer for RISKY
  if (category === "RISKY" && disclaimers.length === 0) {
    disclaimers.push("Conflicting signals in analysis.");
  }

  return disclaimers;
}

/**
 * Generate prediction using ENGINE_SPEC v1.1 scoring model
 * This is the main entry point for the engine
 *
 * Sequence per ENGINE_SPEC v1.1:
 * 1. Apply constraints (usefulness ceilings, correlation rules)
 * 2. Score markets (base + polymarket + groq + gemini)
 * 3. Apply dominance override
 * 4. Select PRIMARY (respecting constraints)
 * 5. Select SECONDARY (respecting correlation rules)
 */
export function generateEnginePrediction(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  analysis: AIAnalysis
): Prediction {
  // Score all markets (includes dominance override)
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

  // Select PRIMARY (respecting usefulness ceilings)
  const primary = selectPrimaryMarket(scores);
  if (!primary) {
    return {
      fixtureId: fixture.id,
      generatedAt: nowGMT1(),
      category: "RISKY",
      primaryMarket: buildMarketSelection(scores[0]),
      alternativeMarket: null,
      allMarkets: scores.slice(1, 5).map(buildMarketSelection),
      narrative: analysis.groqAnalysis.narrative,
      keyFactors: analysis.groqAnalysis.keyFactors,
      disclaimers: ["All markets blocked by constraints."],
    };
  }

  // Determine category per ENGINE_SPEC v1.1 + v1.2 sanity check + v1.4 Draw cap
  const category = determineCategory(
    primary.finalScore,
    analysis.geminiVerification,
    primary.aiProbability,
    primary.marketProbability,
    primary.selection,
    primary.market
  );

  // Select SECONDARY (respecting correlation constraints)
  const secondary = selectSecondaryMarket(scores, primary);

  // Build all markets list (excluding primary, top 4)
  const allMarkets = scores
    .filter((s) => s !== primary)
    .slice(0, 4)
    .map(buildMarketSelection);

  const disclaimers = generateDisclaimers(analysis, category, primary);

  return {
    fixtureId: fixture.id,
    generatedAt: nowGMT1(),
    category,
    primaryMarket: buildMarketSelection(primary),
    alternativeMarket: secondary ? buildMarketSelection(secondary) : null,
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
