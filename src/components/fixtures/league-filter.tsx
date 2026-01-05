"use client";

import { Button } from "@/components/ui/button";
import { LEAGUE_LIST } from "@/config/leagues";
import { cn } from "@/lib/utils";

interface LeagueFilterProps {
  selectedLeagues: string[];
  onToggleLeague: (leagueCode: string) => void;
}

const leagueColors: Record<string, string> = {
  EPL: "data-[active=true]:bg-purple-500/20 data-[active=true]:text-purple-400 data-[active=true]:border-purple-500/30",
  LALIGA: "data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-400 data-[active=true]:border-orange-500/30",
  BL1: "data-[active=true]:bg-red-500/20 data-[active=true]:text-red-400 data-[active=true]:border-red-500/30",
  SA: "data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-400 data-[active=true]:border-blue-500/30",
  FL1: "data-[active=true]:bg-sky-500/20 data-[active=true]:text-sky-400 data-[active=true]:border-sky-500/30",
};

export function LeagueFilter({
  selectedLeagues,
  onToggleLeague,
}: LeagueFilterProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {LEAGUE_LIST.map((league) => {
        const isActive = selectedLeagues.includes(league.code);
        const colorClass = leagueColors[league.code] || "";

        return (
          <Button
            key={league.code}
            variant="outline"
            size="sm"
            data-active={isActive}
            onClick={() => onToggleLeague(league.code)}
            className={cn(
              "h-7 text-xs font-medium transition-colors",
              colorClass,
              !isActive && "text-muted-foreground hover:text-foreground"
            )}
          >
            {league.code}
          </Button>
        );
      })}
    </div>
  );
}
