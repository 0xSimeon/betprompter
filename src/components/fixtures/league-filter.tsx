"use client";

import { Button } from "@/components/ui/button";
import { LEAGUE_LIST } from "@/config/leagues";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

interface LeagueFilterProps {
  selectedLeague: string | null;
  onSelectLeague: (leagueCode: string | null) => void;
}

const leagueColors: Record<string, { active: string; hover: string }> = {
  EPL: {
    active: "bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-purple-500/10",
    hover: "hover:border-purple-500/30 hover:bg-purple-500/10",
  },
  LALIGA: {
    active: "bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-orange-500/10",
    hover: "hover:border-orange-500/30 hover:bg-orange-500/10",
  },
  BL1: {
    active: "bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/10",
    hover: "hover:border-red-500/30 hover:bg-red-500/10",
  },
  SA: {
    active: "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-500/10",
    hover: "hover:border-blue-500/30 hover:bg-blue-500/10",
  },
  FL1: {
    active: "bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sky-500/10",
    hover: "hover:border-sky-500/30 hover:bg-sky-500/10",
  },
};

export function LeagueFilter({
  selectedLeague,
  onSelectLeague,
}: LeagueFilterProps) {
  const isAllActive = selectedLeague === null;

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Filter</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {/* All Leagues Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectLeague(null)}
          className={cn(
            "h-9 px-5 text-xs font-bold tracking-wide transition-all duration-300 relative overflow-hidden group/btn",
            isAllActive
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
              : "text-muted-foreground border-border/40 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-300"
          )}
        >
          <span className="relative z-10">All Leagues</span>
          {isAllActive && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent animate-subtle-float" />
          )}
        </Button>

        {/* Individual League Buttons */}
        {LEAGUE_LIST.map((league) => {
          const isActive = selectedLeague === league.code;
          const colors = leagueColors[league.code];

          return (
            <Button
              key={league.code}
              variant="outline"
              size="sm"
              onClick={() => onSelectLeague(league.code)}
              className={cn(
                "h-9 px-5 text-xs font-bold tracking-wide transition-all duration-300 relative overflow-hidden group/league",
                isActive
                  ? `${colors?.active} shadow-lg`
                  : `text-muted-foreground border-border/40 ${colors?.hover}`
              )}
            >
              <span className="relative z-10">{league.name}</span>
              {isActive && (
                <div className="absolute inset-0 opacity-50 blur-xl"
                  style={{
                    background: isActive ? `radial-gradient(circle, ${
                      league.code === 'EPL' ? 'rgb(168 85 247 / 0.3)' :
                      league.code === 'LALIGA' ? 'rgb(249 115 22 / 0.3)' :
                      league.code === 'BL1' ? 'rgb(239 68 68 / 0.3)' :
                      league.code === 'SA' ? 'rgb(59 130 246 / 0.3)' :
                      'rgb(14 165 233 / 0.3)'
                    }, transparent)` : undefined
                  }}
                />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
