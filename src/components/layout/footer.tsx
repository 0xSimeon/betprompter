import { DISCLAIMER, ATTRIBUTION } from "@/config/constants";
import { TrendingUp } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/30 bg-gradient-to-b from-background to-background/50 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Enhanced Disclaimer with sophisticated styling */}
          <div className="relative py-6 -mx-4 px-4 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            <p className="relative text-center text-sm text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium">
              {DISCLAIMER}
            </p>
          </div>

          {/* Enhanced Attribution */}
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="flex items-center gap-3 text-muted-foreground group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">BetPrompter</span>
            </div>
            <p className="text-xs text-muted-foreground/60 font-medium">
              {ATTRIBUTION}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
