import { DISCLAIMER, ATTRIBUTION } from "@/config/constants";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-400/90">{DISCLAIMER}</p>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground text-center">
            {ATTRIBUTION}
          </p>
        </div>
      </div>
    </footer>
  );
}
