"use client";

import { FixtureCard } from "./fixture-card";
import { EmptyState } from "@/components/shared";
import { getLeagueByCode } from "@/config/leagues";
import type { FixtureWithPrediction } from "@/types";

interface FixtureListProps {
  fixtures: FixtureWithPrediction[];
  selectedLeagues: string[];
}

export function FixtureList({ fixtures, selectedLeagues }: FixtureListProps) {
  // Filter by selected leagues
  const filteredFixtures = fixtures.filter((f) =>
    selectedLeagues.includes(f.leagueCode)
  );

  if (filteredFixtures.length === 0) {
    return (
      <EmptyState
        title="No matches today"
        description="There are no selected matches for the top 5 leagues on this date."
      />
    );
  }

  // Group by league
  const groupedByLeague = filteredFixtures.reduce(
    (acc, fixture) => {
      const league = fixture.leagueCode;
      if (!acc[league]) {
        acc[league] = [];
      }
      acc[league].push(fixture);
      return acc;
    },
    {} as Record<string, FixtureWithPrediction[]>
  );

  // Sort leagues by the configured order
  const leagueOrder = ["EPL", "LALIGA", "BL1", "SA", "FL1"];
  const sortedLeagues = Object.keys(groupedByLeague).sort(
    (a, b) => leagueOrder.indexOf(a) - leagueOrder.indexOf(b)
  );

  return (
    <div className="space-y-6">
      {sortedLeagues.map((leagueCode) => {
        const league = getLeagueByCode(leagueCode);
        const leagueFixtures = groupedByLeague[leagueCode];

        return (
          <div key={leagueCode}>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              {league?.name || leagueCode}
            </h2>
            <div className="space-y-2">
              {leagueFixtures.map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
