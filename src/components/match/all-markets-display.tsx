"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MARKETS } from "@/config/markets";
import type { MarketSelection, MarketSentiment } from "@/types";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

interface AllMarketsDisplayProps {
  markets: MarketSelection[];
  sentiment?: MarketSentiment | null;
}

/**
 * Get market probability for a specific selection from sentiment
 * Handles Polymarket's "Yes"/"No" outcomes for Over/Under markets
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
  // Map "Over X.X" selections to "Yes", "Under X.X" to "No"
  if (marketType === "OVER_2_5" || marketType === "OVER_1_5") {
    const isOverSelection = selectionLower.includes("over");
    const targetOutcome = isOverSelection ? "yes" : "no";
    const outcome = market.outcomes.find(
      (o) => o.name.toLowerCase() === targetOutcome
    );
    if (outcome) {
      return Math.round(outcome.probability * 100);
    }
  }

  // For Match Result, try direct matching
  const outcome = market.outcomes.find((o) => {
    const nameLower = o.name.toLowerCase();
    // Check for exact or partial matches
    return (
      nameLower.includes(selectionLower) ||
      selectionLower.includes(nameLower) ||
      // Handle "Home Win" vs team name matching
      (selectionLower.includes("home") && nameLower.includes("win") && !nameLower.includes("away")) ||
      (selectionLower.includes("away") && nameLower.includes("win") && !nameLower.includes("home")) ||
      (selectionLower.includes("draw") && nameLower.includes("draw"))
    );
  });

  return outcome ? Math.round(outcome.probability * 100) : null;
}

export function AllMarketsDisplay({ markets, sentiment }: AllMarketsDisplayProps) {
  if (!markets || markets.length === 0) return null;

  return (
    <Card className="shadow-lg shadow-black/10 backdrop-blur-sm bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Other Markets</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Additional tips based on AI analysis
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {markets.map((market, idx) => {
          const aiProb = market.confidence;
          const marketProb = getMarketProbForSelection(
            sentiment,
            market.type,
            market.selection
          );
          const edge = marketProb !== null ? aiProb - marketProb : null;

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

              {/* Probability bars */}
              <div className="flex gap-2 mb-2">
                <div className="flex-1 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <span className="text-xs text-blue-400 font-medium">AI</span>
                  <p className="text-sm font-bold text-foreground">{aiProb}%</p>
                </div>
                <div className="flex-1 p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                  <span className="text-xs text-emerald-400 font-medium">Market</span>
                  <p className="text-sm font-bold text-foreground">
                    {marketProb !== null ? `${marketProb}%` : "—"}
                  </p>
                </div>
              </div>

              {/* Edge indicator */}
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
