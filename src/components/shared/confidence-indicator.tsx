"use client";

import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  confidence: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return "text-emerald-400";
  if (confidence >= 50) return "text-amber-400";
  return "text-zinc-400";
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500";
  if (confidence >= 50) return "bg-amber-500";
  return "bg-zinc-500";
}

const sizeStyles = {
  sm: { text: "text-xs", bar: "h-1 w-12" },
  md: { text: "text-sm", bar: "h-1.5 w-16" },
  lg: { text: "text-base", bar: "h-2 w-20" },
};

export function ConfidenceIndicator({
  confidence,
  size = "md",
  showLabel = true,
  className,
}: ConfidenceIndicatorProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <span className={cn(styles.text, getConfidenceColor(confidence), "font-medium tabular-nums")}>
          {confidence}%
        </span>
      )}
      <div className={cn("bg-secondary rounded-full overflow-hidden", styles.bar)}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", getConfidenceBarColor(confidence))}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}
