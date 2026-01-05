"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Lineups, TeamLineup } from "@/types";
import { cn } from "@/lib/utils";

interface LineupsPanelProps {
  lineups: Lineups;
  homeTeamName: string;
  awayTeamName: string;
}

function TeamLineupDisplay({
  lineup,
  teamName,
}: {
  lineup: TeamLineup | null;
  teamName: string;
}) {
  if (!lineup || lineup.players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lineup not available for {teamName}
      </p>
    );
  }

  return (
    <div>
      {lineup.formation && (
        <p className="text-sm text-muted-foreground mb-2">
          Formation: {lineup.formation}
        </p>
      )}
      <ul className="space-y-1">
        {lineup.players.map((player) => (
          <li key={player.id} className="flex items-center gap-2 text-sm">
            {player.shirtNumber && (
              <span className="w-6 text-muted-foreground tabular-nums text-right">
                {player.shirtNumber}
              </span>
            )}
            <span>{player.name}</span>
            {player.position && (
              <span className="text-xs text-muted-foreground">
                ({player.position})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineupsPanel({
  lineups,
  homeTeamName,
  awayTeamName,
}: LineupsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");

  if (!lineups.available) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lineups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Lineups will be available approximately 1 hour before kickoff.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Lineups</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Team tabs */}
          <div className="flex gap-1 p-1 bg-secondary rounded-lg">
            <Button
              variant={activeTeam === "home" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setActiveTeam("home")}
            >
              {homeTeamName}
            </Button>
            <Button
              variant={activeTeam === "away" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setActiveTeam("away")}
            >
              {awayTeamName}
            </Button>
          </div>

          {/* Lineup display */}
          <TeamLineupDisplay
            lineup={activeTeam === "home" ? lineups.home : lineups.away}
            teamName={activeTeam === "home" ? homeTeamName : awayTeamName}
          />
        </CardContent>
      )}
    </Card>
  );
}
