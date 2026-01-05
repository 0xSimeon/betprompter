"use client";

import type { FixtureWithPrediction } from "@/types";

interface FixtureSummaryProps {
  fixtures: FixtureWithPrediction[];
  totalFixtures: number;
}

export function FixtureSummary({ fixtures, totalFixtures }: FixtureSummaryProps) {
  const bankers = fixtures.filter((f) => f.prediction?.category === "BANKER").length;
  const value = fixtures.filter((f) => f.prediction?.category === "VALUE").length;
  const noBet = fixtures.filter((f) => f.prediction?.category === "NO_BET").length;

  return (
    <div className="text-center text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{fixtures.length}</span> matches selected
      {totalFixtures > fixtures.length && (
        <span> from {totalFixtures} total</span>
      )}
      {fixtures.length > 0 && (
        <span className="mx-2">·</span>
      )}
      {bankers > 0 && (
        <span className="text-emerald-400">{bankers} Banker{bankers !== 1 ? "s" : ""}</span>
      )}
      {bankers > 0 && value > 0 && <span className="mx-1">·</span>}
      {value > 0 && (
        <span className="text-amber-400">{value} Value</span>
      )}
      {(bankers > 0 || value > 0) && noBet > 0 && <span className="mx-1">·</span>}
      {noBet > 0 && (
        <span className="text-zinc-400">{noBet} No Bet</span>
      )}
    </div>
  );
}
