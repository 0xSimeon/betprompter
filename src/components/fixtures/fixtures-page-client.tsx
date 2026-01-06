"use client";

import { useState, useMemo } from "react";
import { LeagueFilter } from "./league-filter";
import { FixtureList } from "./fixture-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAGUE_LIST } from "@/config/leagues";
import type { FixtureWithPrediction } from "@/types";

interface FixturesByDate {
  date: string;
  label: string;
  fixtures: FixtureWithPrediction[];
  total: number;
}

interface FixturesPageClientProps {
  today: string;
  fixturesByDate: FixturesByDate[];
}

export function FixturesPageClient({
  today,
  fixturesByDate,
}: FixturesPageClientProps) {
  const [selectedLeagues, setSelectedLeagues] = useState(
    LEAGUE_LIST.map((l) => l.code)
  );

  const handleToggleLeague = (leagueCode: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(leagueCode)
        ? prev.filter((l) => l !== leagueCode)
        : [...prev, leagueCode]
    );
  };

  // Calculate totals for the week
  const weekTotals = useMemo(() => {
    let totalSelected = 0;
    let totalMatches = 0;
    for (const day of fixturesByDate) {
      totalSelected += day.fixtures.length;
      totalMatches += day.total;
    }
    return { totalSelected, totalMatches };
  }, [fixturesByDate]);

  // Filter to days with fixtures
  const daysWithFixtures = useMemo(() => {
    return fixturesByDate.filter((day) => day.fixtures.length > 0);
  }, [fixturesByDate]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Week Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">This Week&apos;s Picks</h1>
            <p className="text-sm text-muted-foreground">
              {weekTotals.totalSelected} selected from {weekTotals.totalMatches} matches
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Mon-Sun
          </Badge>
        </div>

        {/* League Filter */}
        <LeagueFilter
          selectedLeagues={selectedLeagues}
          onToggleLeague={handleToggleLeague}
        />

        {/* Fixtures by Day */}
        {daysWithFixtures.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No fixtures available this week.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back after the weekly cron runs on Sunday night.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {daysWithFixtures.map((day) => (
              <section key={day.date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold">{day.label}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {day.fixtures.length} {day.fixtures.length === 1 ? "pick" : "picks"}
                  </Badge>
                  {day.date === today && (
                    <Badge variant="default" className="text-xs">
                      Today
                    </Badge>
                  )}
                </div>

                {/* Fixtures for this day */}
                <FixtureList
                  fixtures={day.fixtures}
                  selectedLeagues={selectedLeagues}
                />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
