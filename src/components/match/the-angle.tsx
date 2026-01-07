"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, CheckCircle2 } from "lucide-react";

interface TheAngleProps {
  narrative: string;
  keyFactors: string[];
}

export function TheAngle({ narrative, keyFactors }: TheAngleProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg">The Angle</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main narrative */}
        <p className="text-foreground leading-relaxed text-[15px]">{narrative}</p>

        {/* Key factors */}
        {keyFactors.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Key Factors
            </h4>
            <ul className="space-y-2.5">
              {keyFactors.map((factor, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-foreground"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
