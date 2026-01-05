import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/kv";
import {
  MatchHeader,
  PredictionCard,
  TheAngle,
  SentimentPanel,
  LineupsPanel,
} from "@/components/match";
import { Card, CardContent } from "@/components/ui/card";
import { DISCLAIMER } from "@/config/constants";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const fixtureId = parseInt(id, 10);

  if (isNaN(fixtureId)) {
    notFound();
  }

  const match = await getMatchDetail(fixtureId);

  if (!match) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="space-y-6">
        {/* Match Header */}
        <MatchHeader fixture={match} />

        {/* Prediction Card */}
        {match.prediction && <PredictionCard prediction={match.prediction} />}

        {/* The Angle */}
        {match.prediction && (
          <TheAngle
            narrative={match.prediction.narrative}
            keyFactors={match.prediction.keyFactors}
          />
        )}

        {/* Market Sentiment */}
        {match.sentiment && <SentimentPanel sentiment={match.sentiment} />}

        {/* Lineups */}
        {match.lineups && (
          <LineupsPanel
            lineups={match.lineups}
            homeTeamName={match.homeTeam.shortName || match.homeTeam.name}
            awayTeamName={match.awayTeam.shortName || match.awayTeam.name}
          />
        )}

        {/* Disclaimer Banner */}
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="py-3">
            <p className="text-sm text-amber-400/90">{DISCLAIMER}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
