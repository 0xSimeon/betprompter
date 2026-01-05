"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeBars } from "@/components/shared";
import { getRelativeTime } from "@/lib/date";
import type { MarketSentiment } from "@/types";

interface SentimentPanelProps {
  sentiment: MarketSentiment;
}

export function SentimentPanel({ sentiment }: SentimentPanelProps) {
  if (!sentiment.available || sentiment.markets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No market data available for this fixture.
          </p>
        </CardContent>
      </Card>
    );
  }

  const matchResultMarket = sentiment.markets.find(
    (m) => m.type === "MATCH_RESULT"
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Market Sentiment</CardTitle>
          <span className="text-xs text-muted-foreground">
            Updated {getRelativeTime(sentiment.fetchedAt)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchResultMarket && (
          <>
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
