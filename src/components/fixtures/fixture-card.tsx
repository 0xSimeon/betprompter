"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LeagueBadge, CategoryBadge } from "@/components/shared";
import { formatKickoffTime } from "@/lib/date";
import type { FixtureWithPrediction } from "@/types";
import { cn } from "@/lib/utils";

interface FixtureCardProps {
  fixture: FixtureWithPrediction;
  className?: string;
}

export function FixtureCard({ fixture, className }: FixtureCardProps) {
  const { homeTeam, awayTeam, kickoff, leagueCode, prediction, sentiment, id } = fixture;

  // Get top outcome from sentiment if available
  const topOutcome = sentiment?.markets[0]?.outcomes.reduce((a, b) =>
    a.probability > b.probability ? a : b
  );

  return (
    <Link href={`/match/${id}`}>
      <Card
        className={cn(
          "p-4 hover:bg-secondary/50 transition-colors cursor-pointer",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* League and Time */}
            <div className="flex items-center gap-2 mb-2">
              <LeagueBadge leagueCode={leagueCode} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatKickoffTime(kickoff)}
              </span>
            </div>

            {/* Teams */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {homeTeam.crest && (
                  <img
                    src={homeTeam.crest}
                    alt=""
                    className="w-5 h-5 object-contain"
                  />
                )}
                <span className="font-medium truncate">{homeTeam.shortName || homeTeam.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {awayTeam.crest && (
                  <img
                    src={awayTeam.crest}
                    alt=""
                    className="w-5 h-5 object-contain"
                  />
                )}
                <span className="font-medium truncate">{awayTeam.shortName || awayTeam.name}</span>
              </div>
            </div>

            {/* Sentiment snippet */}
            {topOutcome && (
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {topOutcome.name}: {Math.round(topOutcome.probability * 100)}%
              </p>
            )}
          </div>

          {/* Category Badge */}
          <div className="flex flex-col items-end gap-2">
            {prediction && (
              <CategoryBadge category={prediction.category} size="sm" />
            )}
            {/* Chevron */}
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </Card>
    </Link>
  );
}
