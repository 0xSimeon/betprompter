"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { StatsAggregate } from "@/types";

interface StatsOverviewProps {
  stats: StatsAggregate | null;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
}

function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  if (!stats || stats.total === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Predictions" value="0" />
        <StatCard label="Win Rate" value="-" />
        <StatCard label="Bankers" value="-" />
        <StatCard label="Value Plays" value="-" />
      </div>
    );
  }

  const winRate =
    stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  const bankerWinRate =
    stats.byCategory.banker.total > 0
      ? Math.round(
          (stats.byCategory.banker.wins / stats.byCategory.banker.total) * 100
        )
      : 0;

  const valueWinRate =
    stats.byCategory.value.total > 0
      ? Math.round(
          (stats.byCategory.value.wins / stats.byCategory.value.total) * 100
        )
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Total Predictions"
        value={stats.total}
        subtext={`${stats.wins}W - ${stats.losses}L`}
      />
      <StatCard label="Win Rate" value={`${winRate}%`} />
      <StatCard
        label="Bankers"
        value={`${bankerWinRate}%`}
        subtext={`${stats.byCategory.banker.total} bets`}
      />
      <StatCard
        label="Value Plays"
        value={`${valueWinRate}%`}
        subtext={`${stats.byCategory.value.total} bets`}
      />
    </div>
  );
}
