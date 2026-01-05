"use client";

import { Badge } from "@/components/ui/badge";
import type { OutcomeResult } from "@/types";
import { cn } from "@/lib/utils";

interface ResultBadgeProps {
  result: OutcomeResult;
  size?: "sm" | "md";
  className?: string;
}

const resultStyles: Record<OutcomeResult, string> = {
  WIN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  LOSS: "bg-red-500/20 text-red-400 border-red-500/30",
  PUSH: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  VOID: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const resultLabels: Record<OutcomeResult, string> = {
  WIN: "Win",
  LOSS: "Loss",
  PUSH: "Push",
  VOID: "Void",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
};

export function ResultBadge({ result, size = "md", className }: ResultBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(resultStyles[result], sizeStyles[size], "font-medium", className)}
    >
      {resultLabels[result]}
    </Badge>
  );
}
