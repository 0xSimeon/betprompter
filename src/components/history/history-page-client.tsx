"use client";

import { useState } from "react";
import { StatsOverview } from "./stats-overview";
import { HistoryFilters } from "./history-filters";
import { HistoryList } from "./history-list";
import type { Outcome, StatsAggregate, PredictionCategory, OutcomeResult } from "@/types";

interface HistoryPageClientProps {
  initialStats: StatsAggregate | null;
  initialOutcomes: Outcome[];
  availableMonths: string[];
  initialMonth: string;
}

export function HistoryPageClient({
  initialStats,
  initialOutcomes,
  availableMonths,
  initialMonth,
}: HistoryPageClientProps) {
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [categoryFilter, setCategoryFilter] = useState<PredictionCategory | "ALL">("ALL");
  const [resultFilter, setResultFilter] = useState<OutcomeResult | "ALL">("ALL");

  const handleMonthChange = async (month: string) => {
    setSelectedMonth(month);

    try {
      const response = await fetch(`/api/history?month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setOutcomes(data.outcomes);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  // Filter outcomes
  const filteredOutcomes = outcomes.filter((outcome) => {
    if (categoryFilter !== "ALL" && outcome.prediction.category !== categoryFilter) {
      return false;
    }
    if (resultFilter !== "ALL" && outcome.result !== resultFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Prediction History</h1>

        {/* Stats Overview */}
        <StatsOverview stats={initialStats} />

        {/* Filters */}
        <HistoryFilters
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          resultFilter={resultFilter}
          onResultChange={setResultFilter}
          availableMonths={availableMonths}
        />

        {/* History List */}
        <HistoryList outcomes={filteredOutcomes} />
      </div>
    </div>
  );
}
