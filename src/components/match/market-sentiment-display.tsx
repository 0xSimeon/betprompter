"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OutcomeBars } from "@/components/shared";
import { getRelativeTime } from "@/lib/date";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { MarketSentiment, Prediction } from "@/types";

interface MarketSentimentDisplayProps {
  sentiment: MarketSentiment;
  prediction: Prediction | null;
}

function getConfluenceStatus(
  sentiment: MarketSentiment,
  prediction: Prediction | null
): {
  status: "aligned" | "divergent" | "neutral";
  message: string;
  icon: typeof TrendingUp;
} {
  if (!prediction?.primaryMarket || !sentiment.available) {
    return {
      status: "neutral",
      message: "Unable to compare",
      icon: Minus,
    };
  }

  const matchResultMarket = sentiment.markets.find(
    (m) => m.type === "MATCH_RESULT"
  );

  if (!matchResultMarket) {
    return {
      status: "neutral",
      message: "No match result market",
      icon: Minus,
    };
  }

  // Find the market's highest probability outcome
  const sortedOutcomes = [...matchResultMarket.outcomes].sort(
    (a, b) => b.probability - a.probability
  );
  const marketFavorite = sortedOutcomes[0];

  // Check if our prediction aligns with market favorite
  const ourPick = prediction.primaryMarket.selection.toLowerCase();
  const marketPick = marketFavorite.name.toLowerCase();

  // Check alignment (accounting for variations in naming)
  const isAligned =
    ourPick.includes("home") && marketPick.includes("home") ||
    ourPick.includes("away") && marketPick.includes("away") ||
    ourPick.includes("draw") && marketPick.includes("draw") ||
    ourPick === marketPick;

  if (isAligned) {
    return {
      status: "aligned",
      message: `Market agrees (${Math.round(marketFavorite.probability * 100)}%)`,
      icon: TrendingUp,
    };
  }

  // Check if we're backing an underdog (value opportunity)
  const ourOutcome = matchResultMarket.outcomes.find((o) =>
    o.name.toLowerCase().includes(ourPick) ||
    ourPick.includes(o.name.toLowerCase())
  );

  if (ourOutcome && ourOutcome.probability < 0.4) {
    return {
      status: "divergent",
      message: `Value play (${Math.round(ourOutcome.probability * 100)}% market odds)`,
      icon: AlertTriangle,
    };
  }

  return {
    status: "divergent",
    message: "Contrarian to market",
    icon: TrendingDown,
  };
}

export function MarketSentimentDisplay({
  sentiment,
  prediction,
}: MarketSentimentDisplayProps) {
  if (!sentiment.available || sentiment.markets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No Polymarket data available for this fixture.
          </p>
        </CardContent>
      </Card>
    );
  }

  const matchResultMarket = sentiment.markets.find(
    (m) => m.type === "MATCH_RESULT"
  );

  const confluence = getConfluenceStatus(sentiment, prediction);
  const Icon = confluence.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Polymarket Odds</CardTitle>
          <span className="text-xs text-muted-foreground">
            Updated {getRelativeTime(sentiment.fetchedAt)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchResultMarket && (
          <>
            {/* Confluence indicator */}
            {prediction && (
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Badge
                  variant={
                    confluence.status === "aligned"
                      ? "default"
                      : confluence.status === "divergent"
                      ? "secondary"
                      : "outline"
                  }
                  className="gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {confluence.message}
                </Badge>
              </div>
            )}

            {/* Market probabilities */}
            <OutcomeBars outcomes={matchResultMarket.outcomes} />

            {/* Volume indicator */}
            {matchResultMarket.volume > 0 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Trading Volume</span>
                <span className="font-medium tabular-nums">
                  ${matchResultMarket.volume.toLocaleString()}
                </span>
              </div>
            )}
          </>
        )}

        {/* Other markets */}
        {sentiment.markets
          .filter((m) => m.type !== "MATCH_RESULT")
          .map((market) => (
            <div key={market.type} className="pt-3 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {market.question}
              </h4>
              <OutcomeBars outcomes={market.outcomes} />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
