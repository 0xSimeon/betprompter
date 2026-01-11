"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeagueBadge } from "@/components/shared";
import { formatKickoffTime, formatFullDate } from "@/lib/date";
import type { Fixture } from "@/types";
import { ArrowLeft, MapPin, Clock } from "lucide-react";

interface MatchHeaderProps {
  fixture: Fixture;
}

export function MatchHeader({ fixture }: MatchHeaderProps) {
  const { homeTeam, awayTeam, kickoff, venue, leagueCode, status } = fixture;
  const hasScore = fixture.score.home !== null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Fixtures
        </Button>
      </Link>

      {/* League badge and status */}
      <div className="flex items-center justify-center gap-2">
        <LeagueBadge leagueCode={leagueCode} showFullName size="md" />
        {status !== "SCHEDULED" && status !== "TIMED" && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium">
            {status}
          </span>
        )}
      </div>

      {/* Teams display - Enhanced with premium styling */}
      <div className="flex items-start justify-center gap-4 sm:gap-8 py-6 sm:py-8">
        {/* Home team */}
        <div className="flex flex-col items-center gap-3 w-[100px] sm:w-[140px] group">
          <div className="relative w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-secondary/40 to-secondary/20 p-2 sm:p-4 shadow-lg shadow-black/10 ring-1 ring-border/30 group-hover:ring-emerald-500/30 transition-all duration-300">
            {homeTeam.crest ? (
              <img
                src={homeTeam.crest}
                alt={homeTeam.name}
                className="w-full h-full object-contain drop-shadow-lg"
              />
            ) : (
              <span className="text-xl sm:text-3xl font-bold text-muted-foreground">H</span>
            )}
            <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-t from-white/0 to-white/5" />
          </div>
          <span className="font-bold text-center text-xs sm:text-sm leading-tight tracking-tight line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">
            {homeTeam.shortName || homeTeam.name}
          </span>
        </div>

        {/* VS / Score - Enhanced typography */}
        <div className="flex flex-col items-center justify-center px-2 sm:px-4 pt-4 sm:pt-6">
          {hasScore ? (
            <div className="flex items-center gap-2 sm:gap-3 tabular-nums">
              <span className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                {fixture.score.home}
              </span>
              <span className="text-xl sm:text-3xl text-muted-foreground/50 font-extralight">-</span>
              <span className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                {fixture.score.away}
              </span>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-secondary/30 border border-border/30">
              <span className="text-sm sm:text-xl font-black text-muted-foreground tracking-[0.2em] sm:tracking-[0.3em]">VS</span>
            </div>
          )}
        </div>

        {/* Away team */}
        <div className="flex flex-col items-center gap-3 w-[100px] sm:w-[140px] group">
          <div className="relative w-16 h-16 sm:w-24 sm:h-24 flex items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-secondary/40 to-secondary/20 p-2 sm:p-4 shadow-lg shadow-black/10 ring-1 ring-border/30 group-hover:ring-emerald-500/30 transition-all duration-300">
            {awayTeam.crest ? (
              <img
                src={awayTeam.crest}
                alt={awayTeam.name}
                className="w-full h-full object-contain drop-shadow-lg"
              />
            ) : (
              <span className="text-xl sm:text-3xl font-bold text-muted-foreground">A</span>
            )}
            <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-t from-white/0 to-white/5" />
          </div>
          <span className="font-bold text-center text-xs sm:text-sm leading-tight tracking-tight line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">
            {awayTeam.shortName || awayTeam.name}
          </span>
        </div>
      </div>

      {/* Match info - Enhanced with better styling */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/30 border border-border/30">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="text-muted-foreground">{formatFullDate(kickoff)}</span>
          <span className="font-bold text-foreground tabular-nums">
            {formatKickoffTime(kickoff)}
          </span>
        </div>
        {venue && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/30 border border-border/30">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="text-muted-foreground">{venue}</span>
          </div>
        )}
      </div>
    </div>
  );
}
