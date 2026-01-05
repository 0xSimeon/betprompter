"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, ConfidenceIndicator } from "@/components/shared";
import { MARKETS } from "@/config/markets";
import type { Prediction } from "@/types";

interface PredictionCardProps {
  prediction: Prediction;
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const { category, primaryMarket, alternativeMarket } = prediction;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Prediction</CardTitle>
          <CategoryBadge category={category} size="lg" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {category === "NO_BET" ? (
          <p className="text-muted-foreground">
            No recommended market for this fixture. Insufficient edge or high uncertainty.
          </p>
        ) : (
          <>
            {/* Primary Market */}
            {primaryMarket && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {MARKETS[primaryMarket.type]?.name || primaryMarket.type}
                  </span>
                  <ConfidenceIndicator confidence={primaryMarket.confidence} />
                </div>
                <p className="font-semibold text-lg">{primaryMarket.selection}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {primaryMarket.reasoning}
                </p>
              </div>
            )}

            {/* Alternative Market */}
            {alternativeMarket && (
              <div className="p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    Safer alternative: {MARKETS[alternativeMarket.type]?.name}
                  </span>
                  <ConfidenceIndicator
                    confidence={alternativeMarket.confidence}
                    size="sm"
                  />
                </div>
                <p className="font-medium">{alternativeMarket.selection}</p>
              </div>
            )}
          </>
        )}

        {/* Disclaimers */}
        {prediction.disclaimers.length > 0 && (
          <div className="pt-2 border-t border-border">
            <ul className="text-xs text-muted-foreground space-y-1">
              {prediction.disclaimers.map((disclaimer, i) => (
                <li key={i}>• {disclaimer}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
