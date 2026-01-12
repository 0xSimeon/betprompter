"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, ConfidenceIndicator } from "@/components/shared";
import { MARKETS } from "@/config/markets";
import type { Prediction, AIAnalysis, MarketSentiment } from "@/types";
import { Target, Shield, AlertTriangle, Lightbulb, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";

interface AnalysisCardProps {
  prediction: Prediction;
  analysis?: AIAnalysis | null;
  sentiment?: MarketSentiment | null;
}

/**
 * Get AI probability for a specific lean direction from probabilities
 */
function getAIProbForSelection(
  analysis: AIAnalysis | null | undefined,
  selection: string
): number | null {
  if (!analysis?.groqAnalysis.probabilities) return null;

  const selectionLower = selection.toLowerCase();
  const probs = analysis.groqAnalysis.probabilities;

  if (selectionLower.includes("home")) return Math.round(probs.homeWin * 100);
  if (selectionLower.includes("away")) return Math.round(probs.awayWin * 100);
  if (selectionLower.includes("draw")) return Math.round(probs.draw * 100);
  if (selectionLower.includes("over") && selectionLower.includes("2.5")) return Math.round(probs.over25 * 100);
  if (selectionLower.includes("over") && selectionLower.includes("1.5")) return Math.round(probs.over15 * 100);
  // Per ENGINE_SPEC: BTTS is not a supported market

  return null;
}

/**
 * Get market probability for a specific selection from sentiment
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
  const outcome = market.outcomes.find((o) => {
    const nameLower = o.name.toLowerCase();
    return (
      (selectionLower.includes("home") && nameLower.includes("home")) ||
      (selectionLower.includes("away") && nameLower.includes("away")) ||
      (selectionLower.includes("draw") && nameLower.includes("draw")) ||
      nameLower.includes(selectionLower) ||
      selectionLower.includes(nameLower)
    );
  });

  return outcome ? Math.round(outcome.probability * 100) : null;
}

export function AnalysisCard({ prediction, analysis, sentiment }: AnalysisCardProps) {
  const { category, primaryMarket, alternativeMarket, narrative, keyFactors, disclaimers } = prediction;
  const isBanker = category === "BANKER";
  const isRisky = category === "RISKY";

  // Get real probabilities when available
  const aiProbability = primaryMarket
    ? getAIProbForSelection(analysis, primaryMarket.selection) ?? primaryMarket.confidence
    : null;

  const marketProbability = primaryMarket
    ? getMarketProbForSelection(sentiment, primaryMarket.type, primaryMarket.selection)
    : null;

  // Calculate edge (AI vs Market)
  const edge = aiProbability !== null && marketProbability !== null
    ? aiProbability - marketProbability
    : null;

  // Card border based on category
  const cardBorderClass = isBanker
    ? "border-emerald-500/30"
    : isRisky
      ? "border-red-500/20"
      : undefined;

  return (
    <Card className={`shadow-xl shadow-black/20 backdrop-blur-sm bg-card/95 ${cardBorderClass}`}>
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
            <CardTitle className="text-lg">Analysis & Prediction</CardTitle>
          </div>
          <CategoryBadge category={category} size="lg" />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Primary Market Selection */}
        {primaryMarket ? (
          <div className={`p-4 rounded-lg ${
            isBanker
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : isRisky
                ? "bg-red-500/5 border border-red-500/20"
                : "bg-secondary/50"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isBanker ? "Banker Pick" : isRisky ? "Risky Pick" : "Value Pick"}
              </span>
              <span className="text-xs text-muted-foreground">
                {MARKETS[primaryMarket.type]?.name || primaryMarket.type}
              </span>
            </div>
            <p className="font-bold text-xl mb-2">{primaryMarket.selection}</p>
            {/* Engine probability per UI_UX_SPEC v1.1 section 2.1 */}
            <p className="text-sm font-medium text-foreground/80 mb-2">
              Engine probability: ~{primaryMarket.confidence}%
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {primaryMarket.reasoning}
            </p>

            {/* Dual Probability Display - AI vs Market */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <span className="text-xs text-blue-400 font-medium">AI Estimate</span>
                <p className="text-lg font-bold text-foreground">
                  {aiProbability !== null ? `${aiProbability}%` : "—"}
                </p>
              </div>
              <div className="flex-1 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <span className="text-xs text-emerald-400 font-medium">Market Odds</span>
                <p className="text-lg font-bold text-foreground">
                  {marketProbability !== null ? `${marketProbability}%` : "—"}
                </p>
              </div>
            </div>

            {/* Edge Indicator - Show when both probabilities available */}
            {edge !== null && (
              <div className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-sm ${
                edge > 5
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : edge < -5
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : "bg-secondary/50 text-muted-foreground"
              }`}>
                {edge > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : edge < 0 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : null}
                <span className="font-medium">
                  {edge > 0 ? "+" : ""}{edge}% edge vs market
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-sm text-muted-foreground">
              No specific market suggestion available.
            </p>
          </div>
        )}

        {/* Alternative Market - Not shown for RISKY per UI_UX_SPEC v1.1 section 2.2 */}
        {alternativeMarket && !isRisky && (
          <div className="p-4 rounded-lg border border-border/50 bg-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Safer Alternative
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {MARKETS[alternativeMarket.type]?.name}
              </span>
            </div>
            <p className="font-semibold mb-1">{alternativeMarket.selection}</p>
            <p className="text-sm text-muted-foreground">
              Engine probability: ~{alternativeMarket.confidence}%
            </p>
          </div>
        )}

        {/* The Angle - Narrative Section */}
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-foreground">The Angle</h4>
          </div>
          <p className="text-foreground leading-relaxed text-[15px] mb-4">{narrative}</p>

          {/* Key Factors */}
          {keyFactors.length > 0 && (
            <div className="pt-3">
              <h5 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Key Factors
              </h5>
              <ul className="space-y-2">
                {keyFactors.map((factor, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-foreground"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Why Risky? Section - Only for RISKY picks */}
        {isRisky && disclaimers.length > 0 && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                Why Risky?
              </h4>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {disclaimers.map((disclaimer, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-400/50 mt-0.5">•</span>
                  <span>{disclaimer}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Standard Disclaimers - For non-RISKY picks */}
        {!isRisky && disclaimers.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {disclaimers.map((disclaimer, i) => (
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
