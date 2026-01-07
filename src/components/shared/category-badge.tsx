"use client";

import { Badge } from "@/components/ui/badge";
import type { PredictionCategory } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: PredictionCategory;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const categoryStyles: Record<PredictionCategory, string> = {
  BANKER: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  VALUE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  RISKY: "bg-red-500/20 text-red-400 border-red-500/30",
};

const categoryLabels: Record<PredictionCategory, string> = {
  BANKER: "Banker",
  VALUE: "Value",
  RISKY: "Risky",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export function CategoryBadge({
  category,
  size = "md",
  className,
}: CategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        categoryStyles[category],
        sizeStyles[size],
        "font-medium",
        className
      )}
    >
      {categoryLabels[category]}
    </Badge>
  );
}
