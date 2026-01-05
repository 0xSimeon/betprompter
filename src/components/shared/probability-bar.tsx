"use client";

import { cn } from "@/lib/utils";

interface ProbabilityBarProps {
  label: string;
  probability: number; // 0-1
  colorClass?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProbabilityBar({
  label,
  probability,
  colorClass = "bg-primary",
  showPercentage = true,
  className,
}: ProbabilityBarProps) {
  const percentage = Math.round(probability * 100);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {showPercentage && (
          <span className="font-medium tabular-nums">{percentage}%</span>
        )}
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface OutcomeBarsProps {
  outcomes: Array<{
    name: string;
    probability: number;
  }>;
  className?: string;
}

const outcomeColors = [
  "bg-emerald-500",
  "bg-zinc-500",
  "bg-amber-500",
];

export function OutcomeBars({ outcomes, className }: OutcomeBarsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {outcomes.map((outcome, index) => (
        <ProbabilityBar
          key={outcome.name}
          label={outcome.name}
          probability={outcome.probability}
          colorClass={outcomeColors[index % outcomeColors.length]}
        />
      ))}
    </div>
  );
}
