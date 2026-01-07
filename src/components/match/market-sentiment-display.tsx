"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OutcomeBars } from "@/components/shared";
import { getRelativeTime } from "@/lib/date";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, DollarSign, Clock } from "lucide-react";
import type { MarketSentiment, Prediction } from "@/types";

interface MarketSentimentDisplayProps {
  sentiment: MarketSentiment | null;
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
  if (!sentiment || !sentiment.available || sentiment.markets.length === 0) {
    return (
      <Card className="shadow-xl shadow-black/20 backdrop-blur-sm bg-card/95 h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Market Sentiment</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
            <Minus className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">No market data</p>
              <p className="text-sm text-muted-foreground">
                Polymarket data is not available for this fixture.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const matchResultMarket = sentiment.markets.find(
    (m) => m.type === "MATCH_RESULT"
  );

  const confluence = getConfluenceStatus(sentiment, prediction);
  const Icon = confluence.icon;

  const confluenceStyles = {
    aligned: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    divergent: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    neutral: "bg-secondary text-muted-foreground border-border",
  };

  return (
    <Card className="shadow-xl shadow-black/20 backdrop-blur-sm bg-card/95 h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-lg">Polymarket Odds</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {getRelativeTime(sentiment.fetchedAt)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchResultMarket && (
          <>
            {/* Confluence indicator */}
            {prediction && (
              <div className="pb-4 border-b border-border/50">
                <Badge
                  variant="outline"
                  className={`gap-1.5 px-3 py-1.5 ${confluenceStyles[confluence.status]}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {confluence.message}
                </Badge>
              </div>
            )}

            {/* Market probabilities */}
            <OutcomeBars outcomes={matchResultMarket.outcomes} />

            {/* Volume indicator */}
            {matchResultMarket.volume > 0 && (
              <div className="flex items-center justify-between text-sm pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span>Trading Volume</span>
                </div>
                <span className="font-semibold tabular-nums text-foreground">
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
            <div key={market.type} className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {market.question}
              </h4>
              <OutcomeBars outcomes={market.outcomes} />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
