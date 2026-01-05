"use client";

import { Badge } from "@/components/ui/badge";
import { getLeagueByCode } from "@/config/leagues";
import { cn } from "@/lib/utils";

interface LeagueBadgeProps {
  leagueCode: string;
  showFullName?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const leagueColors: Record<string, string> = {
  EPL: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  LALIGA: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  BL1: "bg-red-500/20 text-red-400 border-red-500/30",
  SA: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  FL1: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

const sizeStyles = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export function LeagueBadge({
  leagueCode,
  showFullName = false,
  size = "sm",
  className,
}: LeagueBadgeProps) {
  const league = getLeagueByCode(leagueCode);
  const displayName = showFullName
    ? league?.name || leagueCode
    : league?.code || leagueCode;

  const colorClass = leagueColors[league?.code || ""] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

  return (
    <Badge
      variant="outline"
      className={cn(colorClass, sizeStyles[size], "font-medium", className)}
    >
      {displayName}
    </Badge>
  );
}
