"use client";

import { useState, useMemo } from "react";
import { LeagueFilter } from "./league-filter";
import { FixtureList } from "./fixture-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FixtureWithPrediction } from "@/types";
import { Calendar, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

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

// Per UI_UX_SPEC: Default shows 72h (3 days), rest accessible via date tabs
const DEFAULT_DAYS_SHOWN = 3;

export function FixturesPageClient({
  today,
  fixturesByDate,
}: FixturesPageClientProps) {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"default" | "all" | number>("default");

  const handleSelectLeague = (leagueCode: string | null) => {
    setSelectedLeague(leagueCode);
  };

  // Get dates to display based on selection
  const displayedDates = useMemo(() => {
    if (selectedDateRange === "default") {
      // Show first 3 days (72h window)
      return fixturesByDate.slice(0, DEFAULT_DAYS_SHOWN);
    }
    if (selectedDateRange === "all") {
      return fixturesByDate;
    }
    // Single day selected
    return fixturesByDate.filter((_, idx) => idx === selectedDateRange);
  }, [fixturesByDate, selectedDateRange]);

  // Calculate totals for displayed dates
  const displayTotals = useMemo(() => {
    let totalSelected = 0;
    let totalMatches = 0;
    for (const day of displayedDates) {
      totalSelected += day.fixtures.length;
      totalMatches += day.total;
    }
    return { totalSelected, totalMatches };
  }, [displayedDates]);

  // Apply league filter, then filter to days with fixtures
  const daysWithFixtures = useMemo(() => {
    return displayedDates
      .map((day) => ({
        ...day,
        fixtures: selectedLeague
          ? day.fixtures.filter((f) => f.leagueCode === selectedLeague)
          : day.fixtures,
      }))
      .filter((day) => day.fixtures.length > 0);
  }, [displayedDates, selectedLeague]);

  // Get short day labels for tabs
  const getShortLabel = (label: string, date: string) => {
    if (date === today) return "Today";
    if (label === "Tomorrow") return "Tomorrow";
    // Extract day name (e.g., "Wed" from "Wed, 15 Jan")
    const parts = label.split(",");
    return parts[0] || label;
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">
                Predictions
              </h1>
            </div>
            <p className="text-sm text-muted-foreground font-medium ml-[52px]">
              <span className="font-bold text-emerald-400 tabular-nums">{displayTotals.totalSelected}</span>
              <span className="mx-1.5 text-muted-foreground/50">/</span>
              <span className="tabular-nums">{displayTotals.totalMatches}</span> matches selected
            </p>
          </div>
        </div>

        {/* Date Navigation Tabs - Per UI_UX_SPEC */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button
            variant={selectedDateRange === "default" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDateRange("default")}
            className="shrink-0"
          >
            Next 72h
          </Button>
          <div className="w-px h-6 bg-border/50" />
          {fixturesByDate.slice(0, 7).map((day, idx) => (
            <Button
              key={day.date}
              variant={selectedDateRange === idx ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedDateRange(idx)}
              className={`shrink-0 ${day.date === today ? "ring-1 ring-emerald-500/50" : ""}`}
            >
              {getShortLabel(day.label, day.date)}
              {day.fixtures.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {day.fixtures.length}
                </Badge>
              )}
            </Button>
          ))}
          {fixturesByDate.length > 7 && (
            <>
              <div className="w-px h-6 bg-border/50" />
              <Button
                variant={selectedDateRange === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDateRange("all")}
                className="shrink-0"
              >
                All 2 weeks
              </Button>
            </>
          )}
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
              <p className="text-muted-foreground font-medium">No fixtures for selected dates</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try selecting a different date range
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {daysWithFixtures.map((day) => (
              <section key={day.date} className="animate-fade-in-up">
                {/* Date Header */}
                <div className="flex items-center gap-4 mb-5 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/40 ring-1 ring-border/30">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight">{day.label}</h2>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1 bg-secondary/50 border border-border/30">
                    {day.fixtures.length} {day.fixtures.length === 1 ? "pick" : "picks"}
                  </Badge>
                  {day.date === today && (
                    <Badge className="text-xs font-bold px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                      Today
                    </Badge>
                  )}
                </div>

                {/* Fixtures */}
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
