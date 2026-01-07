"use client";

import { FixtureCard } from "./fixture-card";
import { EmptyState } from "@/components/shared";
import { getLeagueByCode } from "@/config/leagues";
import type { FixtureWithPrediction } from "@/types";

interface FixtureListProps {
  fixtures: FixtureWithPrediction[];
  selectedLeague: string | null;
}

export function FixtureList({ fixtures, selectedLeague }: FixtureListProps) {
  // Filter by selected league (null = show all)
  const filteredFixtures = selectedLeague
    ? fixtures.filter((f) => f.leagueCode === selectedLeague)
    : fixtures;

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
            <div className="space-y-4">
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
