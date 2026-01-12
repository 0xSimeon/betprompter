import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/kv";
import {
  MatchHeader,
  AnalysisCard,
  AllMarketsDisplay,
  MarketSentimentDisplay,
  LineupsPanel,
  DataFreshnessIndicator,
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
      <div className="space-y-6">
        {/* Status Row - Read-only per UI_UX_SPEC */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <FixtureStatusBadge
            kickoff={match.kickoff}
            lineupsAvailable={lineupsAvailable}
            matchStatus={match.status}
          />
          <DataFreshnessIndicator
            generatedAt={match.prediction?.generatedAt ?? null}
            sentimentAvailable={match.sentiment?.available ?? false}
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

        {/* Other Market Tips - Full width below */}
        {match.prediction?.allMarkets && match.prediction.allMarkets.length > 0 && (
          <AllMarketsDisplay
            markets={match.prediction.allMarkets}
            sentiment={match.sentiment}
            primaryType={match.prediction.primaryMarket?.type}
            secondaryType={match.prediction.alternativeMarket?.type}
          />
        )}

        {/* Lineups - Full width below */}
        {match.lineups && (
          <LineupsPanel
            lineups={match.lineups}
            homeTeamName={match.homeTeam.shortName || match.homeTeam.name}
            awayTeamName={match.awayTeam.shortName || match.awayTeam.name}
          />
        )}
      </div>
    </div>
  );
}
