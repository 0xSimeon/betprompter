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
  children,
}: AutoRefreshWrapperProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "refreshing" | "updated" | "error">("idle");
  const [updateMessage, setUpdateMessage] = useState<string>("");

  useEffect(() => {
    const minsUntil = minutesUntilKickoff(kickoff);

    // Only auto-refresh if within 55 min window and lineups not available
    if (minsUntil <= 55 && minsUntil > 0 && !lineupsAvailable) {
      setStatus("refreshing");

      fetch(`/api/match/${fixtureId}/refresh`)
        .then((res) => res.json())
        .then((data: RefreshResult) => {
          if (data.lineupsUpdated || data.analysisUpdated) {
            const messages: string[] = [];
            if (data.lineupsUpdated) messages.push("Lineups fetched");
            if (data.analysisUpdated) messages.push("Analysis updated");
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
  }, [fixtureId, kickoff, lineupsAvailable, router]);

  return (
    <>
      {/* Status Banner */}
      {status === "refreshing" && (
        <Alert className="bg-blue-500/10 border-blue-500/20 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <AlertDescription className="text-blue-400 ml-2">
            Checking for lineups and updating analysis...
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
