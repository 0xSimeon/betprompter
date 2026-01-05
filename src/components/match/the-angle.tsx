"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TheAngleProps {
  narrative: string;
  keyFactors: string[];
}

export function TheAngle({ narrative, keyFactors }: TheAngleProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">The Angle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main narrative */}
        <p className="text-foreground leading-relaxed">{narrative}</p>

        {/* Key factors */}
        {keyFactors.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Key Factors
            </h4>
            <ul className="space-y-1.5">
              {keyFactors.map((factor, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span className="text-muted-foreground mt-1">•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
