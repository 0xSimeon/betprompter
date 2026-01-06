"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { minutesUntilKickoff, hasKickedOff } from "@/lib/date";
import { Clock, Users, Zap, Play, CheckCircle } from "lucide-react";

type FixtureStatus = "pre-match" | "lineups-available" | "starting-soon" | "live" | "finished";

interface FixtureStatusBadgeProps {
  kickoff: string;
  lineupsAvailable: boolean;
  matchStatus: string;
}

function getStatus(
  kickoff: string,
  lineupsAvailable: boolean,
  matchStatus: string
): FixtureStatus {
  // Check match status first
  if (matchStatus === "FINISHED" || matchStatus === "AWARDED") {
    return "finished";
  }

  if (matchStatus === "IN_PLAY" || matchStatus === "PAUSED") {
    return "live";
  }

  const minsUntil = minutesUntilKickoff(kickoff);

  // Match already started based on time
  if (hasKickedOff(kickoff)) {
    return "live";
  }

  // Within 15 minutes
  if (minsUntil <= 15 && minsUntil > 0) {
    return "starting-soon";
  }

  // Within 60 minutes with lineups
  if (minsUntil <= 60 && lineupsAvailable) {
    return "lineups-available";
  }

  return "pre-match";
}

const statusConfig: Record<
  FixtureStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
  "pre-match": {
    label: "Pre-match",
    variant: "secondary",
    icon: Clock,
  },
  "lineups-available": {
    label: "Lineups In",
    variant: "default",
    icon: Users,
  },
  "starting-soon": {
    label: "Starting Soon",
    variant: "destructive",
    icon: Zap,
  },
  live: {
    label: "Live",
    variant: "destructive",
    icon: Play,
  },
  finished: {
    label: "Finished",
    variant: "outline",
    icon: CheckCircle,
  },
};

export function FixtureStatusBadge({
  kickoff,
  lineupsAvailable,
  matchStatus,
}: FixtureStatusBadgeProps) {
  const [status, setStatus] = useState<FixtureStatus>(() =>
    getStatus(kickoff, lineupsAvailable, matchStatus)
  );

  // Update status periodically for time-based states
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getStatus(kickoff, lineupsAvailable, matchStatus));
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [kickoff, lineupsAvailable, matchStatus]);

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
