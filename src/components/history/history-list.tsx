"use client";

import { Card } from "@/components/ui/card";
import { LeagueBadge, CategoryBadge, ResultBadge } from "@/components/shared";
import { MARKETS } from "@/config/markets";
import { formatFullDate } from "@/lib/date";
import type { Outcome } from "@/types";
import { EmptyState } from "@/components/shared";

interface HistoryListProps {
  outcomes: Outcome[];
}

export function HistoryList({ outcomes }: HistoryListProps) {
  if (outcomes.length === 0) {
    return (
      <EmptyState
        title="No predictions yet"
        description="Prediction history will appear here once matches are settled."
      />
    );
  }

  // Group by date
  const groupedByDate = outcomes.reduce(
    (acc, outcome) => {
      if (!acc[outcome.date]) {
        acc[outcome.date] = [];
      }
      acc[outcome.date].push(outcome);
      return acc;
    },
    {} as Record<string, Outcome[]>
  );

  // Sort dates descending
  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {formatFullDate(date + "T12:00:00+01:00")}
          </h3>
          <div className="space-y-2">
            {groupedByDate[date].map((outcome) => (
              <HistoryItem key={outcome.id} outcome={outcome} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryItem({ outcome }: { outcome: Outcome }) {
  const { prediction, finalScore, result, homeTeam, awayTeam, leagueCode } =
    outcome;

  const marketName = MARKETS[prediction.marketType]?.shortName || prediction.marketType;

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* League */}
          <LeagueBadge leagueCode={leagueCode} className="mb-2" />

          {/* Match */}
          <p className="font-medium truncate">
            {homeTeam} vs {awayTeam}
          </p>

          {/* Prediction info */}
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <CategoryBadge category={prediction.category} size="sm" />
            <span>·</span>
            <span>{marketName}</span>
            <span>·</span>
            <span>{prediction.selection}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* Score */}
          <span className="text-lg font-semibold tabular-nums">
            {finalScore.home} - {finalScore.away}
          </span>

          {/* Result */}
          <ResultBadge result={result} size="sm" />
        </div>
      </div>
    </Card>
  );
}
