"use client";

import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in",
        className
      )}
    >
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-border/50 flex items-center justify-center">
          {icon || <Inbox className="w-7 h-7 text-muted-foreground" />}
        </div>
        {/* Decorative rings */}
        <div className="absolute inset-0 -m-2 rounded-3xl border border-border/30 animate-pulse-glow" />
        <div className="absolute inset-0 -m-4 rounded-[28px] border border-border/20" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}
    </div>
  );
}
