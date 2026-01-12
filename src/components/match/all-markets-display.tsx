"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MARKETS } from "@/config/markets";
import type { MarketSelection, MarketSentiment } from "@/types";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

interface AllMarketsDisplayProps {
  markets: MarketSelection[];
  sentiment?: MarketSentiment | null;
  primaryType?: string;
  secondaryType?: string;
}

/**
 * Correlated market pairs per ENGINE_SPEC v1.1
 * These should not appear together
 */
const CORRELATED_PAIRS: Array<[string, string]> = [
  ["MATCH_RESULT", "DOUBLE_CHANCE"],
  ["OVER_1_5", "DOUBLE_CHANCE"],
  ["OVER_1_5", "OVER_2_5"],
];

function isCorrelatedWith(marketType: string, primaryType?: string, secondaryType?: string): boolean {
  if (!primaryType && !secondaryType) return false;

  return CORRELATED_PAIRS.some(([a, b]) => {
    const matchesPrimary = primaryType &&
      ((marketType === a && primaryType === b) || (marketType === b && primaryType === a));
    const matchesSecondary = secondaryType &&
      ((marketType === a && secondaryType === b) || (marketType === b && secondaryType === a));
    return matchesPrimary || matchesSecondary;
  });
}

/**
 * Get market probability for a specific selection from sentiment
 * Handles Polymarket's various outcome naming conventions
 */
function getMarketProbForSelection(
  sentiment: MarketSentiment | null | undefined,
  marketType: string,
  selection: string
): number | null {
  if (!sentiment?.available || !sentiment.markets.length) return null;

  const market = sentiment.markets.find((m) => m.type === marketType);
  if (!market) return null;

  const selectionLower = selection.toLowerCase();

  // For Over/Under markets, Polymarket uses "Yes"/"No" outcomes
  if (marketType === "OVER_2_5" || marketType === "OVER_1_5") {
    const isOverSelection = selectionLower.includes("over");
    // Try "Yes"/"No" first
    let outcome = market.outcomes.find(
      (o) => o.name.toLowerCase() === (isOverSelection ? "yes" : "no")
    );
    // Also try "Over"/"Under" naming
    if (!outcome) {
      outcome = market.outcomes.find(
        (o) => o.name.toLowerCase().includes(isOverSelection ? "over" : "under")
      );
    }
    if (outcome) {
      return Math.round(outcome.probability * 100);
    }
  }

  // For Double Chance, calculate from Match Result if available
  if (marketType === "DOUBLE_CHANCE") {
    const matchResult = sentiment.markets.find((m) => m.type === "MATCH_RESULT");
    if (matchResult) {
      // 1X = Home + Draw, X2 = Away + Draw, 12 = Home + Away
      const homeOutcome = matchResult.outcomes.find((o) =>
        o.name.toLowerCase().includes("home") ||
        (o.name.toLowerCase().includes("win") && !o.name.toLowerCase().includes("away") && !o.name.toLowerCase().includes("draw"))
      );
      const awayOutcome = matchResult.outcomes.find((o) =>
        o.name.toLowerCase().includes("away") ||
        matchResult.outcomes.indexOf(o) === matchResult.outcomes.length - 1 // Last non-draw is usually away
      );
      const drawOutcome = matchResult.outcomes.find((o) =>
        o.name.toLowerCase().includes("draw")
      );

      if (selectionLower === "1x" && homeOutcome && drawOutcome) {
        return Math.round((homeOutcome.probability + drawOutcome.probability) * 100);
      }
      if (selectionLower === "x2" && awayOutcome && drawOutcome) {
        return Math.round((awayOutcome.probability + drawOutcome.probability) * 100);
      }
      if (selectionLower === "12" && homeOutcome && awayOutcome) {
        return Math.round((homeOutcome.probability + awayOutcome.probability) * 100);
      }
    }
  }

  // For Match Result, handle team names vs "Home Win"/"Away Win"
  const outcome = market.outcomes.find((o) => {
    const nameLower = o.name.toLowerCase();
    return (
      nameLower.includes(selectionLower) ||
      selectionLower.includes(nameLower) ||
      // "Home Win" should match any outcome containing "win" that's not "away" or "draw"
      (selectionLower.includes("home") && nameLower.includes("win") && !nameLower.includes("away")) ||
      (selectionLower.includes("away") && nameLower.includes("win")) ||
      (selectionLower.includes("draw") && nameLower.includes("draw"))
    );
  });

  return outcome ? Math.round(outcome.probability * 100) : null;
}

export function AllMarketsDisplay({ markets, sentiment, primaryType, secondaryType }: AllMarketsDisplayProps) {
  if (!markets || markets.length === 0) return null;

  // Per UI_UX_SPEC v1.1 section 3: Filter out markets with no usable signal
  const validMarkets = markets.filter((market) => {
    // Must have valid AI confidence (> 0)
    if (!market.confidence || market.confidence <= 0) return false;

    // Exclude PRIMARY and SECONDARY markets
    if (market.type === primaryType || market.type === secondaryType) return false;

    // Exclude correlation-blocked markets
    if (isCorrelatedWith(market.type, primaryType, secondaryType)) return false;

    return true;
  });

  // Don't render section if no valid markets
  if (validMarkets.length === 0) return null;

  return (
    <Card className="shadow-lg shadow-black/10 backdrop-blur-sm bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Other Markets</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Additional analysis from engine scoring
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {validMarkets.map((market, idx) => {
          const aiProb = market.confidence;
          const marketProb = getMarketProbForSelection(
            sentiment,
            market.type,
            market.selection
          );
          const hasMarketData = marketProb !== null;
          const edge = hasMarketData ? aiProb - marketProb : null;

          return (
            <div
              key={idx}
              className="p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-border transition-colors"
            >
              {/* Market name and selection */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {MARKETS[market.type]?.name || market.type}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {market.selection}
                </span>
              </div>

              {/* Probability display - per spec 3.2: show AI only if no market data */}
              {hasMarketData ? (
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    <span className="text-xs text-blue-400 font-medium">AI</span>
                    <p className="text-sm font-bold text-foreground">{aiProb}%</p>
                  </div>
                  <div className="flex-1 p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <span className="text-xs text-emerald-400 font-medium">Market</span>
                    <p className="text-sm font-bold text-foreground">{marketProb}%</p>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20 mb-2">
                  <span className="text-xs text-blue-400 font-medium">AI Estimate</span>
                  <p className="text-sm font-bold text-foreground">{aiProb}%</p>
                </div>
              )}

              {/* Edge indicator - only when both probabilities available */}
              {edge !== null && (
                <div
                  className={`flex items-center gap-1.5 text-xs ${
                    edge > 5
                      ? "text-emerald-400"
                      : edge < -5
                        ? "text-red-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {edge > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : edge < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  <span className="font-medium">
                    {edge > 0 ? "+" : ""}
                    {edge}% edge
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
