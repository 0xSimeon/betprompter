"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MARKETS, type MarketType } from "@/config/markets";
import type { StatsAggregate, CategoryStats } from "@/types";

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

interface MarketStatCardProps {
  marketType: MarketType;
  marketStats: CategoryStats;
}

function MarketStatCard({ marketType, marketStats }: MarketStatCardProps) {
  const market = MARKETS[marketType];
  const winRate =
    marketStats.total > 0
      ? Math.round((marketStats.wins / marketStats.total) * 100)
      : 0;

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground mb-1">{market.shortName}</p>
        <p className="text-xl font-semibold tabular-nums">
          {marketStats.total > 0 ? `${winRate}%` : "-"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {marketStats.total} bets
        </p>
      </CardContent>
    </Card>
  );
}

function calculateWinRate(stats: CategoryStats): number {
  return stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
}

interface BestMarket {
  type: MarketType;
  winRate: number;
  total: number;
}

function findBestMarket(
  byMarket: Record<MarketType, CategoryStats>
): BestMarket | null {
  const marketTypes = Object.keys(byMarket) as MarketType[];

  // Filter to markets with >= 3 bets to avoid small sample bias
  const qualified = marketTypes
    .filter((type) => byMarket[type].total >= 3)
    .map((type) => ({
      type,
      winRate: calculateWinRate(byMarket[type]),
      total: byMarket[type].total,
    }))
    .sort((a, b) => b.winRate - a.winRate);

  return qualified.length > 0 ? qualified[0] : null;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  if (!stats || stats.total === 0) {
    return (
      <div className="space-y-6">
        {/* Category Performance - Empty State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Category Performance
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total" value="0" />
            <StatCard label="Win Rate" value="-" />
            <StatCard label="Bankers" value="-" />
            <StatCard label="Value" value="-" />
            <StatCard label="Risky" value="-" />
          </div>
        </div>

        {/* Market Performance - Empty State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Market Performance
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(MARKETS) as MarketType[]).map((type) => (
              <Card key={type}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {MARKETS[type].shortName}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">-</p>
                  <p className="text-xs text-muted-foreground mt-1">0 bets</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const winRate = calculateWinRate(stats);
  const bankerWinRate = calculateWinRate(stats.byCategory.banker);
  const valueWinRate = calculateWinRate(stats.byCategory.value);
  const riskyWinRate = calculateWinRate(stats.byCategory.risky);
  const bestMarket = findBestMarket(stats.byMarket);

  return (
    <div className="space-y-6">
      {/* Category Performance */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Category Performance
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard
            label="Total"
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
            label="Value"
            value={`${valueWinRate}%`}
            subtext={`${stats.byCategory.value.total} bets`}
          />
          <StatCard
            label="Risky"
            value={`${riskyWinRate}%`}
            subtext={`${stats.byCategory.risky.total} bets`}
          />
        </div>
      </div>

      {/* Market Performance */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Market Performance
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(MARKETS) as MarketType[]).map((type) => (
            <MarketStatCard
              key={type}
              marketType={type}
              marketStats={stats.byMarket[type]}
            />
          ))}
        </div>

        {/* Best Performing Market Highlight */}
        {bestMarket && (
          <Card className="mt-3 bg-muted/50">
            <CardContent className="py-3 px-4">
              <p className="text-sm">
                <span className="text-muted-foreground">Top Market: </span>
                <span className="font-medium">
                  {MARKETS[bestMarket.type].name}
                </span>
                <span className="text-muted-foreground"> — </span>
                <span className="font-semibold">{bestMarket.winRate}%</span>
                <span className="text-muted-foreground">
                  {" "}
                  win rate ({bestMarket.total} bets)
                </span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
