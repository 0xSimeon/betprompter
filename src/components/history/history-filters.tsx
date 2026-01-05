"use client";

import { Button } from "@/components/ui/button";
import type { PredictionCategory, OutcomeResult } from "@/types";
import { cn } from "@/lib/utils";

interface HistoryFiltersProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  categoryFilter: PredictionCategory | "ALL";
  onCategoryChange: (category: PredictionCategory | "ALL") => void;
  resultFilter: OutcomeResult | "ALL";
  onResultChange: (result: OutcomeResult | "ALL") => void;
  availableMonths: string[];
}

export function HistoryFilters({
  selectedMonth,
  onMonthChange,
  categoryFilter,
  onCategoryChange,
  resultFilter,
  onResultChange,
  availableMonths,
}: HistoryFiltersProps) {
  const formatMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-3">
      {/* Month selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Month:</span>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="h-8 px-2 text-sm rounded-md border border-input bg-background"
        >
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {formatMonth(month)}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1">
        {(["ALL", "BANKER", "VALUE"] as const).map((cat) => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onCategoryChange(cat)}
            className={cn(
              "h-7 text-xs",
              cat === "BANKER" &&
                categoryFilter === cat &&
                "text-emerald-400",
              cat === "VALUE" &&
                categoryFilter === cat &&
                "text-amber-400"
            )}
          >
            {cat === "ALL" ? "All" : cat === "BANKER" ? "Bankers" : "Value"}
          </Button>
        ))}
      </div>

      {/* Result filter */}
      <div className="flex flex-wrap gap-1">
        {(["ALL", "WIN", "LOSS"] as const).map((res) => (
          <Button
            key={res}
            variant={resultFilter === res ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onResultChange(res)}
            className={cn(
              "h-7 text-xs",
              res === "WIN" && resultFilter === res && "text-emerald-400",
              res === "LOSS" && resultFilter === res && "text-red-400"
            )}
          >
            {res === "ALL" ? "All Results" : res === "WIN" ? "Wins" : "Losses"}
          </Button>
        ))}
      </div>
    </div>
  );
}
