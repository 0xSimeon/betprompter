"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { minutesUntilKickoff } from "@/lib/date";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";

interface AutoRefreshWrapperProps {
  fixtureId: number;
  kickoff: string;
  lineupsAvailable: boolean;
  hasAnalysis: boolean;
  children: React.ReactNode;
}

interface RefreshResult {
  lineupsUpdated: boolean;
  sentimentUpdated: boolean;
  analysisUpdated: boolean;
  lineupsAvailable: boolean;
}

export function AutoRefreshWrapper({
  fixtureId,
  kickoff,
  lineupsAvailable,
  hasAnalysis,
  children,
}: AutoRefreshWrapperProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "refreshing" | "updated" | "error">("idle");
  const [updateMessage, setUpdateMessage] = useState<string>("");

  useEffect(() => {
    const minsUntil = minutesUntilKickoff(kickoff);

    // Auto-refresh conditions:
    // 1. If no analysis exists yet (first visit) - always fetch
    // 2. If within 55 min window and lineups not available
    // 3. Skip if match already started (minsUntil <= 0)
    const needsAnalysis = !hasAnalysis;
    const needsLineups = minsUntil <= 55 && minsUntil > 0 && !lineupsAvailable;
    const shouldRefresh = (needsAnalysis || needsLineups) && minsUntil > 0;

    if (shouldRefresh) {
      setStatus("refreshing");

      fetch(`/api/match/${fixtureId}/refresh`)
        .then((res) => res.json())
        .then((data: RefreshResult) => {
          if (data.lineupsUpdated || data.analysisUpdated || data.sentimentUpdated) {
            const messages: string[] = [];
            if (data.sentimentUpdated) messages.push("Market data loaded");
            if (data.analysisUpdated) messages.push("Analysis generated");
            if (data.lineupsUpdated) messages.push("Lineups fetched");
            setUpdateMessage(messages.join(" • "));
            setStatus("updated");
            router.refresh();
          } else {
            setStatus("idle");
          }
        })
        .catch(() => {
          setStatus("error");
        });
    }
  }, [fixtureId, kickoff, lineupsAvailable, hasAnalysis, router]);

  return (
    <>
      {/* Status Banner */}
      {status === "refreshing" && (
        <Alert className="bg-blue-500/10 border-blue-500/20 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <AlertDescription className="text-blue-400 ml-2">
            Loading market data and generating analysis...
          </AlertDescription>
        </Alert>
      )}

      {status === "updated" && (
        <Alert className="bg-green-500/10 border-green-500/20 mb-4">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <AlertDescription className="text-green-400 ml-2">
            {updateMessage}
          </AlertDescription>
        </Alert>
      )}

      {children}
    </>
  );
}
