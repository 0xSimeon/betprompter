"use client";

import { useState } from "react";
import { DateSelector } from "./date-selector";
import { LeagueFilter } from "./league-filter";
import { FixtureSummary } from "./fixture-summary";
import { FixtureList } from "./fixture-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getTodayGMT1 } from "@/lib/date";
import { LEAGUE_LIST } from "@/config/leagues";
import type { FixtureWithPrediction } from "@/types";

interface FixturesPageClientProps {
  initialDate: string;
  initialFixtures: FixtureWithPrediction[];
  totalFixtures: number;
}

export function FixturesPageClient({
  initialDate,
  initialFixtures,
  totalFixtures,
}: FixturesPageClientProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [total, setTotal] = useState(totalFixtures);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLeagues, setSelectedLeagues] = useState(
    LEAGUE_LIST.map((l) => l.code)
  );

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/fixtures?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setFixtures(data.fixtures);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch fixtures:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLeague = (leagueCode: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(leagueCode)
        ? prev.filter((l) => l !== leagueCode)
        : [...prev, leagueCode]
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
        />

        {/* League Filter */}
        <LeagueFilter
          selectedLeagues={selectedLeagues}
          onToggleLeague={handleToggleLeague}
        />

        {/* Summary */}
        <FixtureSummary fixtures={fixtures} totalFixtures={total} />

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          /* Fixture List */
          <FixtureList
            fixtures={fixtures}
            selectedLeagues={selectedLeagues}
          />
        )}
      </div>
    </div>
  );
}
