/**
 * Supported bet market types
 * Per ENGINE_SPEC: Only these 4 markets are allowed
 */

export type MarketType =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "OVER_1_5"
  | "OVER_2_5";

export interface MarketConfig {
  type: MarketType;
  name: string;
  shortName: string;
  description: string;
  outcomes: string[];
}

export const MARKETS: Record<MarketType, MarketConfig> = {
  MATCH_RESULT: {
    type: "MATCH_RESULT",
    name: "Match Result",
    shortName: "1X2",
    description: "Who will win the match?",
    outcomes: ["Home Win", "Draw", "Away Win"],
  },
  DOUBLE_CHANCE: {
    type: "DOUBLE_CHANCE",
    name: "Double Chance",
    shortName: "DC",
    description: "Two outcomes covered",
    outcomes: ["1X", "X2", "12"],
  },
  OVER_1_5: {
    type: "OVER_1_5",
    name: "Over 1.5 Goals",
    shortName: "O1.5",
    description: "Total goals over 1.5",
    outcomes: ["Over 1.5", "Under 1.5"],
  },
  OVER_2_5: {
    type: "OVER_2_5",
    name: "Over 2.5 Goals",
    shortName: "O2.5",
    description: "Total goals over 2.5",
    outcomes: ["Over 2.5", "Under 2.5"],
  },
};

export const MARKET_LIST = Object.values(MARKETS);
