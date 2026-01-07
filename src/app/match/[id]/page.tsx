import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/kv";
import {
  MatchHeader,
  AnalysisCard,
  MarketSentimentDisplay,
  LineupsPanel,
  AutoRefreshWrapper,
  RefreshButton,
} from "@/components/match";
import { FixtureStatusBadge } from "@/components/shared";

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
    <div className="container mx-auto px-4 py-6 max-w-5xl">
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

          {/* Side-by-side: Analysis + Market Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Combined Analysis Card */}
            {match.prediction && (
              <AnalysisCard
                prediction={match.prediction}
                analysis={match.analysis}
                sentiment={match.sentiment}
              />
            )}

            {/* Right: Market Sentiment - Always show */}
            <MarketSentimentDisplay
              sentiment={match.sentiment}
              prediction={match.prediction}
            />
          </div>

          {/* Lineups - Full width below */}
          {match.lineups && (
            <LineupsPanel
              lineups={match.lineups}
              homeTeamName={match.homeTeam.shortName || match.homeTeam.name}
              awayTeamName={match.awayTeam.shortName || match.awayTeam.name}
            />
          )}
        </div>
      </AutoRefreshWrapper>
    </div>
  );
}
