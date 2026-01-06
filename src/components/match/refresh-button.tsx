"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { minutesUntilKickoff } from "@/lib/date";

interface RefreshButtonProps {
  fixtureId: number;
  kickoff: string;
  lineupsAvailable: boolean;
}

export function RefreshButton({
  fixtureId,
  kickoff,
  lineupsAvailable,
}: RefreshButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const minsUntil = minutesUntilKickoff(kickoff);

  // Only show button if within 60 min of kickoff OR lineups not available
  const shouldShow = minsUntil <= 60 || !lineupsAvailable;

  if (!shouldShow || minsUntil <= 0) {
    return null;
  }

  const handleRefresh = async () => {
    setStatus("loading");

    try {
      const res = await fetch(`/api/match/${fixtureId}/refresh`);
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        router.refresh();

        // Reset to idle after 2 seconds
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={status === "loading"}
      className="gap-2"
    >
      {status === "loading" && (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Refreshing...
        </>
      )}
      {status === "success" && (
        <>
          <Check className="h-4 w-4 text-green-500" />
          Updated
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4 text-red-500" />
          Failed
        </>
      )}
      {status === "idle" && (
        <>
          <RefreshCw className="h-4 w-4" />
          {lineupsAvailable ? "Refresh" : "Check Lineups"}
        </>
      )}
    </Button>
  );
}
