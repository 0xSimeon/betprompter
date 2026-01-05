"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeagueBadge } from "@/components/shared";
import { formatKickoffTime, formatFullDate } from "@/lib/date";
import type { Fixture } from "@/types";

interface MatchHeaderProps {
  fixture: Fixture;
}

export function MatchHeader({ fixture }: MatchHeaderProps) {
  const { homeTeam, awayTeam, kickoff, venue, leagueCode, status } = fixture;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Fixtures
        </Button>
      </Link>

      {/* League badge */}
      <div className="flex items-center gap-2">
        <LeagueBadge leagueCode={leagueCode} showFullName />
        {status !== "SCHEDULED" && status !== "TIMED" && (
          <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
            {status}
          </span>
        )}
      </div>

      {/* Teams display */}
      <div className="flex items-center justify-center gap-6 py-4">
        {/* Home team */}
        <div className="flex flex-col items-center gap-2 flex-1">
          {homeTeam.crest && (
            <img
              src={homeTeam.crest}
              alt={homeTeam.name}
              className="w-16 h-16 object-contain"
            />
          )}
          <span className="font-semibold text-center">{homeTeam.name}</span>
        </div>

        {/* VS / Score */}
        <div className="flex flex-col items-center">
          {fixture.score.home !== null ? (
            <span className="text-3xl font-bold tabular-nums">
              {fixture.score.home} - {fixture.score.away}
            </span>
          ) : (
            <span className="text-xl font-medium text-muted-foreground">vs</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex flex-col items-center gap-2 flex-1">
          {awayTeam.crest && (
            <img
              src={awayTeam.crest}
              alt={awayTeam.name}
              className="w-16 h-16 object-contain"
            />
          )}
          <span className="font-semibold text-center">{awayTeam.name}</span>
        </div>
      </div>

      {/* Match info */}
      <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
        <span>{formatFullDate(kickoff)}</span>
        <span className="font-medium text-foreground tabular-nums">
          {formatKickoffTime(kickoff)}
        </span>
        {venue && <span>{venue}</span>}
      </div>
    </div>
  );
}
