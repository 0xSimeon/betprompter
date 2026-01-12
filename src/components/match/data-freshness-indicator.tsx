"use client";

import { Clock } from "lucide-react";

interface DataFreshnessIndicatorProps {
  generatedAt: string | null;
  sentimentAvailable: boolean;
}

/**
 * Read-only indicator showing when data was last computed.
 * Per UI_UX_SPEC: No refresh buttons, transparency over interactivity.
 */
export function DataFreshnessIndicator({
  generatedAt,
  sentimentAvailable,
}: DataFreshnessIndicatorProps) {
  if (!generatedAt) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Awaiting analysis</span>
      </div>
    );
  }

  const date = new Date(generatedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  let timeAgo: string;
  if (diffMins < 1) {
    timeAgo = "Just now";
  } else if (diffMins < 60) {
    timeAgo = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours}h ago`;
  } else {
    timeAgo = date.toLocaleDateString();
  }

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        <span>Updated {timeAgo}</span>
      </div>
      {!sentimentAvailable && (
        <span className="text-amber-500">• Market sentiment unavailable</span>
      )}
    </div>
  );
}
