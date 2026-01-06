import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/kv";
import {
  MatchHeader,
  PredictionCard,
  TheAngle,
  MarketSentimentDisplay,
  LineupsPanel,
  AutoRefreshWrapper,
  RefreshButton,
} from "@/components/match";
import { FixtureStatusBadge } from "@/components/shared";
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

  const lineupsAvailable = match.lineups?.available ?? false;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <AutoRefreshWrapper
        fixtureId={fixtureId}
        kickoff={match.kickoff}
        lineupsAvailable={lineupsAvailable}
      >
        <div className="space-y-6">
          {/* Status and Refresh Row */}
          <div className="flex items-center justify-between">
            <FixtureStatusBadge
              kickoff={match.kickoff}
              lineupsAvailable={lineupsAvailable}
              matchStatus={match.status}
            />
            <RefreshButton
              fixtureId={fixtureId}
              kickoff={match.kickoff}
              lineupsAvailable={lineupsAvailable}
            />
          </div>

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
          {match.sentiment && (
            <MarketSentimentDisplay
              sentiment={match.sentiment}
              prediction={match.prediction}
            />
          )}

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
      </AutoRefreshWrapper>
    </div>
  );
}
