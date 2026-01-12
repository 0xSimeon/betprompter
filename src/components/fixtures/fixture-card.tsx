"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LeagueBadge, CategoryBadge, FixtureStatusBadge } from "@/components/shared";
import { formatKickoffTime } from "@/lib/date";
import type { FixtureWithPrediction } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronRight, TrendingUp } from "lucide-react";

interface FixtureCardProps {
  fixture: FixtureWithPrediction;
  className?: string;
}

export function FixtureCard({ fixture, className }: FixtureCardProps) {
  const { homeTeam, awayTeam, kickoff, leagueCode, prediction, sentiment, id, status, lineups } = fixture;

  // Show the actual prediction pick, NOT the market's top outcome
  // This prevents confusion where BANKER shows with unrelated market probability
  const primaryPick = prediction?.primaryMarket;

  const isBanker = prediction?.category === "BANKER";

  return (
    <Link href={`/match/${id}`} className="block group">
      <Card
        className={cn(
          "p-5 cursor-pointer transition-all duration-300 ease-out",
          "hover:border-border/80 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-0.5",
          "active:scale-[0.99]",
          "backdrop-blur-sm bg-card/95",
          isBanker && "border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5",
          className
        )}
      >
        {/* Enhanced gradient overlay for Banker picks */}
        {isBanker && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-emerald-500/3 to-transparent pointer-events-none rounded-xl" />
        )}
        {/* Subtle shine effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl" />

        <div className="flex items-start justify-between gap-4 relative">
          <div className="flex-1 min-w-0">
            {/* League, Time, and Status */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <LeagueBadge leagueCode={leagueCode} />
              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                {formatKickoffTime(kickoff)}
              </span>
              <FixtureStatusBadge
                kickoff={kickoff}
                lineupsAvailable={lineups?.available ?? false}
                matchStatus={status}
              />
            </div>

            {/* Teams */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary/50 shrink-0">
                  {homeTeam.crest ? (
                    <img
                      src={homeTeam.crest}
                      alt=""
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">H</span>
                  )}
                </div>
                <span className="font-semibold truncate">{homeTeam.shortName || homeTeam.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary/50 shrink-0">
                  {awayTeam.crest ? (
                    <img
                      src={awayTeam.crest}
                      alt=""
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">A</span>
                  )}
                </div>
                <span className="font-semibold truncate">{awayTeam.shortName || awayTeam.name}</span>
              </div>
            </div>

            {/* Show actual prediction pick - NOT market's top outcome */}
            {primaryPick && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span className="truncate">
                  {primaryPick.selection}
                </span>
              </div>
            )}
          </div>

          {/* Category Badge and Chevron */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            {prediction && (
              <CategoryBadge category={prediction.category} size="sm" />
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
