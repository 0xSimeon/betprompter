/**
 * Core type definitions for BetPrompter
 * All datetime strings are ISO format in GMT+1
 */

import type { MarketType } from "@/config/markets";

// ============================================
// Fixture Types
// ============================================

export type FixtureStatus =
  | "SCHEDULED"
  | "TIMED"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED";

export interface Team {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export interface Fixture {
  id: number;
  leagueCode: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoff: string; // ISO datetime in GMT+1
  venue: string | null;
  matchday: number;
  status: FixtureStatus;
  score: Score;
}

// ============================================
// Lineup Types
// ============================================

export interface Player {
  id: number;
  name: string;
  position: string | null;
  shirtNumber: number | null;
}

export interface TeamLineup {
  formation: string | null;
  players: Player[];
}

export interface Lineups {
  fixtureId: number;
  fetchedAt: string; // GMT+1
  available: boolean;
  home: TeamLineup | null;
  away: TeamLineup | null;
}

// ============================================
// Market Sentiment Types
// ============================================

export interface MarketOutcome {
  name: string;
  probability: number; // 0-1
  tokenId: string;
}

export interface Market {
  type: MarketType;
  question: string;
  volume: number;
  outcomes: MarketOutcome[];
}

export interface MarketSentiment {
  fixtureId: number;
  polymarketEventId: string | null;
  available: boolean;
  fetchedAt: string; // GMT+1
  markets: Market[];
}

// ============================================
// AI Analysis Types
// ============================================

export type LeanDirection = "HOME" | "DRAW" | "AWAY" | "NEUTRAL";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface GroqAnalysis {
  narrative: string;
  keyFactors: string[];
  lean: LeanDirection;
  confidence: ConfidenceLevel;
  suggestedMarket: MarketType | null;
  suggestedOutcome: string | null;
  concerns: string[];
  // Probability estimates from AI (0-1)
  // Per ENGINE_SPEC: Only 4 markets allowed (ML, DC, O1.5, O2.5)
  probabilities?: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over15: number;
    over25: number;
  };
}

/**
 * Per ENGINE_SPEC: Gemini outputs risk flags only
 * - overconfidence: true/false
 * - missingContext: true/false
 * - cautionLevel: none | mild | strong
 */
export type CautionLevel = "none" | "mild" | "strong";

export interface GeminiVerification {
  overconfidence: boolean;
  missingContext: boolean;
  cautionLevel: CautionLevel;
  // Legacy fields for backwards compatibility with UI
  overconfidenceReason?: string;
  missingContextReason?: string;
}

export interface AIAnalysis {
  fixtureId: number;
  generatedAt: string; // GMT+1
  inputHash: string;
  groqAnalysis: GroqAnalysis;
  geminiVerification: GeminiVerification;
}

// ============================================
// Prediction Types
// ============================================

export type PredictionCategory = "BANKER" | "VALUE" | "RISKY";

export interface MarketSelection {
  type: MarketType;
  selection: string;
  confidence: number; // 0-100
  reasoning: string;
}

export interface Prediction {
  fixtureId: number;
  generatedAt: string; // GMT+1
  category: PredictionCategory;
  primaryMarket: MarketSelection | null;
  alternativeMarket: MarketSelection | null;
  allMarkets: MarketSelection[]; // All computed market tips
  narrative: string;
  keyFactors: string[];
  disclaimers: string[];
}

// ============================================
// History / Outcome Types
// ============================================

export type OutcomeResult = "WIN" | "LOSS" | "PUSH" | "VOID";

export interface PredictionRecord {
  category: PredictionCategory;
  marketType: MarketType;
  selection: string;
  confidence: number;
}

export interface Outcome {
  id: string; // fixtureId + date composite
  date: string; // YYYY-MM-DD GMT+1
  fixtureId: number;
  leagueCode: string;
  homeTeam: string;
  awayTeam: string;
  prediction: PredictionRecord;
  finalScore: Score;
  result: OutcomeResult;
  settledAt: string; // GMT+1
}

// ============================================
// Stats Aggregate Types
// ============================================

export interface CategoryStats {
  total: number;
  wins: number;
  losses: number;
  pushes: number;
}

export interface StatsAggregate {
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  byCategory: {
    banker: CategoryStats;
    value: CategoryStats;
    risky: CategoryStats;
  };
  byMarket: Record<MarketType, CategoryStats>;
  lastUpdated: string; // GMT+1
}

// ============================================
// Combined View Types (for API responses)
// ============================================

export interface FixtureWithPrediction extends Fixture {
  sentiment: MarketSentiment | null;
  prediction: Prediction | null;
  lineups: Lineups | null;
}

export interface MatchDetail extends Fixture {
  sentiment: MarketSentiment | null;
  analysis: AIAnalysis | null;
  prediction: Prediction | null;
  lineups: Lineups | null;
}

// ============================================
// Selection Filter Types
// ============================================

export type SelectionReason =
  | "BIG_TEAM"
  | "HIGH_MARKET_CONFIDENCE"
  | "CONTEXTUAL_EDGE";

export interface SelectedFixture extends Fixture {
  selectionReason: SelectionReason;
}
