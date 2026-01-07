"use client";

import { useState, useMemo } from "react";
import { LeagueFilter } from "./league-filter";
import { FixtureList } from "./fixture-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FixtureWithPrediction } from "@/types";
import { Calendar, Sparkles, CalendarDays } from "lucide-react";

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
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);

  const handleSelectLeague = (leagueCode: string | null) => {
    setSelectedLeague(leagueCode);
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

  // Apply league filter at the week level, then filter to days with fixtures
  const daysWithFixtures = useMemo(() => {
    return fixturesByDate
      .map((day) => ({
        ...day,
        fixtures: selectedLeague
          ? day.fixtures.filter((f) => f.leagueCode === selectedLeague)
          : day.fixtures,
      }))
      .filter((day) => day.fixtures.length > 0);
  }, [fixturesByDate, selectedLeague]);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="space-y-10">
        {/* Enhanced Week Header with premium styling */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text">
                This Week&apos;s Picks
              </h1>
            </div>
            <p className="text-sm text-muted-foreground font-medium ml-[52px]">
              <span className="font-bold text-emerald-400 tabular-nums">{weekTotals.totalSelected}</span>
              <span className="mx-1.5 text-muted-foreground/50">/</span>
              <span className="tabular-nums">{weekTotals.totalMatches}</span> matches selected by AI
            </p>
          </div>
          <Badge variant="outline" className="text-xs px-4 py-2 gap-2 w-fit font-bold tracking-wide border-border/40 bg-secondary/30">
            <CalendarDays className="w-4 h-4" />
            Mon-Sun
          </Badge>
        </div>

        {/* League Filter */}
        <LeagueFilter
          selectedLeague={selectedLeague}
          onSelectLeague={handleSelectLeague}
        />

        {/* Fixtures by Day */}
        {daysWithFixtures.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">No fixtures available this week</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back after the weekly analysis runs on Sunday night
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12">
            {daysWithFixtures.map((day) => (
              <section key={day.date} className="animate-fade-in-up">
                {/* Enhanced Date Header */}
                <div className="flex items-center gap-4 mb-6 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/40 ring-1 ring-border/30">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">{day.label}</h2>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold px-3 py-1 bg-secondary/50 border border-border/30">
                    {day.fixtures.length} {day.fixtures.length === 1 ? "pick" : "picks"}
                  </Badge>
                  {day.date === today && (
                    <Badge className="text-xs font-bold px-3 py-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20">
                      Today
                    </Badge>
                  )}
                </div>

                {/* Fixtures for this day */}
                <FixtureList
                  fixtures={day.fixtures}
                  selectedLeague={null}
                />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
