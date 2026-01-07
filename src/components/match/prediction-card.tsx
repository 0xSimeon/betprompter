"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, ConfidenceIndicator } from "@/components/shared";
import { MARKETS } from "@/config/markets";
import type { Prediction } from "@/types";
import { Target, Shield, AlertTriangle } from "lucide-react";

interface PredictionCardProps {
  prediction: Prediction;
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const { category, primaryMarket, alternativeMarket } = prediction;
  const isBanker = category === "BANKER";
  const isRisky = category === "RISKY";

  // Determine card border color based on category
  const cardBorderClass = isBanker
    ? "border-emerald-500/30"
    : isRisky
      ? "border-red-500/20"
      : undefined;

  return (
    <Card className={cardBorderClass}>
      {/* Gradient accent for Banker picks */}
      {isBanker && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      )}
      {/* Red gradient accent for Risky picks */}
      {isRisky && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Prediction</CardTitle>
          </div>
          <CategoryBadge category={category} size="lg" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Market - Always shown now (including RISKY) */}
        {primaryMarket && (
          <div className={`p-4 rounded-lg ${
            isBanker
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : isRisky
                ? "bg-red-500/5 border border-red-500/20"
                : "bg-secondary/50"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                {MARKETS[primaryMarket.type]?.name || primaryMarket.type}
              </span>
              <ConfidenceIndicator confidence={primaryMarket.confidence} />
            </div>
            <p className="font-bold text-xl mb-2">{primaryMarket.selection}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {primaryMarket.reasoning}
            </p>
          </div>
        )}

        {/* Alternative Market */}
        {alternativeMarket && !isRisky && (
          <div className="p-4 rounded-lg border border-border/50 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Safer Alternative
              </span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {MARKETS[alternativeMarket.type]?.name}
              </span>
              <ConfidenceIndicator
                confidence={alternativeMarket.confidence}
                size="sm"
              />
            </div>
            <p className="font-semibold">{alternativeMarket.selection}</p>
          </div>
        )}

        {/* Why Risky? Section - Only for RISKY picks */}
        {isRisky && prediction.disclaimers.length > 0 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                Why Risky?
              </h4>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {prediction.disclaimers.map((disclaimer, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-400/50 mt-0.5">•</span>
                  <span>{disclaimer}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Standard Disclaimers - For non-RISKY picks */}
        {!isRisky && prediction.disclaimers.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {prediction.disclaimers.map((disclaimer, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground/50 mt-0.5">•</span>
                  <span>{disclaimer}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
