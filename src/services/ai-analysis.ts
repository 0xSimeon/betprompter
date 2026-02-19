/**
 * AI Analysis Service
 * Primary: Groq (Llama 3.3 70B)
 * Verification: Google Gemini
 */

import { nowGMT1 } from "@/lib/date";
import { MARKETS, type MarketType } from "@/config/markets";
import type {
  Fixture,
  MarketSentiment,
  Lineups,
  AIAnalysis,
  GroqAnalysis,
  GeminiVerification,
  LeanDirection,
  ConfidenceLevel,
} from "@/types";
import crypto from "crypto";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Default probabilities when AI output is invalid or missing
const DEFAULT_PROBABILITIES = {
  homeWin: 0.40,
  draw: 0.25,
  awayWin: 0.35,
  over15: 0.55,
  over25: 0.50,
};

/**
 * Generate a hash of the inputs for change detection
 */
function generateInputHash(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  lineups: Lineups | null
): string {
  const input = JSON.stringify({
    fixtureId: fixture.id,
    homeTeam: fixture.homeTeam.name,
    awayTeam: fixture.awayTeam.name,
    sentiment: sentiment?.markets || null,
    hasLineups: lineups?.available || false,
  });

  return crypto.createHash("md5").update(input).digest("hex");
}

/**
 * Build prompt for Groq analysis
 */
function buildGroqPrompt(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  lineups: Lineups | null
): string {
  // Calculate total market volume for guidance
  const totalVolume = sentiment?.markets.reduce((sum, m) => sum + m.volume, 0) || 0;
  const volumeSignal = totalVolume > 10000 ? "HIGH" : totalVolume > 1000 ? "MODERATE" : "LOW";

  let prompt = `Analyze this football match and provide betting insights.

MATCH: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}
LEAGUE: ${fixture.leagueCode}
KICKOFF: ${fixture.kickoff}
VENUE: ${fixture.venue || "Unknown"}
`;

  if (sentiment?.available && sentiment.markets.length > 0) {
    prompt += `
POLYMARKET DATA (${volumeSignal} LIQUIDITY - $${totalVolume.toLocaleString()} total):
`;
    for (const market of sentiment.markets) {
      prompt += `${market.question}\n`;
      for (const outcome of market.outcomes) {
        prompt += `  - ${outcome.name}: ${(outcome.probability * 100).toFixed(1)}%\n`;
      }
      prompt += `  Volume: $${market.volume.toLocaleString()}\n`;
    }

    prompt += `
POLYMARKET INTERPRETATION:
- ${volumeSignal === "HIGH" ? "HIGH liquidity markets are VERY reliable. Respect these odds unless you have strong evidence to disagree." : volumeSignal === "MODERATE" ? "MODERATE liquidity - reasonably reliable market signal." : "LOW liquidity - less reliable, rely more on your analysis."}
- If market shows >65% for an outcome, the crowd strongly favors it
- VALUE opportunity: Your estimate differs from market by >10%
- If you DISAGREE with the market, you MUST explain WHY in your narrative
`;
  } else {
    prompt += `
MARKET SENTIMENT: Not available. Rely on your football knowledge.
`;
  }

  if (lineups?.available) {
    prompt += `
LINEUPS CONFIRMED:
Home formation: ${lineups.home?.formation || "Unknown"}
Away formation: ${lineups.away?.formation || "Unknown"}
Factor confirmed lineups into your analysis - key players present/absent matters.
`;
  }

  prompt += `
YOUR TASK:
You are an expert football analyst with encyclopedic knowledge. Generate a betting analysis.

USE YOUR KNOWLEDGE OF:
- Team form (last 5 matches), playing styles, home/away records
- Manager tactics, key injuries, suspensions
- Head-to-head history, motivation factors
- League position, recent results

CLASSIFICATION GUIDANCE:
- BANKER picks: You AND market agree (>60%), high confidence
- VALUE picks: Your probability > market by >10% (you see edge they don't)
- RISKY: Low confidence, conflicting signals, uncertain outcomes

CRITICAL RULES:
1. Be SPECIFIC in keyFactors - cite actual stats, players, recent results
2. Narrative must explain your EDGE or ANGLE, not just describe the match
3. If market favors an outcome >65% and you agree, say so
4. If you disagree with market, explain your reasoning
5. ALWAYS suggest a specific bet - never say "avoid" or "skip"

Respond in this EXACT JSON format:
{
  "narrative": "string - explain your KEY ANGLE, be specific",
  "keyFactors": ["string - specific factor", "string", ...],
  "lean": "HOME" | "DRAW" | "AWAY",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "suggestedMarket": "MATCH_RESULT" | "DOUBLE_CHANCE" | "OVER_1_5" | "OVER_2_5",
  "suggestedOutcome": "string",
  "concerns": ["string - specific risk", ...],
  "probabilities": {
    "homeWin": 0.xx,
    "draw": 0.xx,
    "awayWin": 0.xx,
    "over15": 0.xx,
    "over25": 0.xx
  }
}

PROBABILITY RULES:
- homeWin + draw + awayWin must equal ~1.0
- Strong home favorites: 55-75%
- Evenly matched: 30-40% home/away, 25-30% draw
- Dominant teams rarely exceed 75-80% even at home
- Be calibrated - don't inflate probabilities without evidence`;

  return prompt;
}

/**
 * Build prompt for Gemini risk challenger
 * Per ENGINE_SPEC: Gemini only returns risk flags, no decisions
 */
function buildGeminiPrompt(
  fixture: Fixture,
  groqAnalysis: GroqAnalysis,
  sentiment: MarketSentiment | null
): string {
  // Build market context
  let marketContext = "";
  if (sentiment?.available && sentiment.markets.length > 0) {
    marketContext = "POLYMARKET DATA:\n";
    for (const market of sentiment.markets) {
      for (const outcome of market.outcomes) {
        marketContext += `${outcome.name}: ${(outcome.probability * 100).toFixed(1)}%\n`;
      }
    }
  }

  return `You are a RISK CHALLENGER. Review this football betting analysis and flag concerns.

MATCH: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}

${marketContext}

ANALYSIS TO REVIEW:
- Narrative: ${groqAnalysis.narrative}
- Lean: ${groqAnalysis.lean}
- Confidence: ${groqAnalysis.confidence}
- Suggested: ${groqAnalysis.suggestedMarket} - ${groqAnalysis.suggestedOutcome}
- Key Factors: ${groqAnalysis.keyFactors.join("; ")}
- Concerns listed: ${groqAnalysis.concerns.join("; ") || "None"}

YOUR TASK - Answer ONLY these questions:
1. Is this OVERCONFIDENT? (HIGH confidence without strong evidence, or probabilities too extreme)
2. Is there MISSING CONTEXT? (Important factors ignored like injuries, form, H2H)
3. Is CAUTION warranted? (none = analysis is solid, mild = minor concerns, strong = major red flags)

Respond in this EXACT JSON format:
{
  "overconfidence": true or false,
  "overconfidenceReason": "string or null - brief reason if true",
  "missingContext": true or false,
  "missingContextReason": "string or null - what's missing if true",
  "cautionLevel": "none" | "mild" | "strong"
}

Be measured. Only flag issues that would MATERIALLY affect the bet:
- overconfidence: TRUE only if HIGH confidence is claimed without strong supporting evidence
- missingContext: TRUE only if a KEY factor is missing (injuries to starters, major form collapse, critical H2H pattern)
- cautionLevel: "strong" is reserved for genuinely risky situations, not minor omissions

If the analysis is reasonable and well-supported, return cautionLevel: "none".`;
}

/**
 * Validate and normalize AI probability outputs
 * Ensures probabilities sum to ~1.0 and are within reasonable ranges
 */
function validateAndNormalizeProbabilities(
  probs: GroqAnalysis["probabilities"] | undefined
): NonNullable<GroqAnalysis["probabilities"]> {
  if (!probs) {
    console.warn("[AI] No probabilities provided, using defaults");
    return { ...DEFAULT_PROBABILITIES };
  }

  // Validate all required fields exist
  if (
    typeof probs.homeWin !== "number" ||
    typeof probs.draw !== "number" ||
    typeof probs.awayWin !== "number"
  ) {
    console.warn("[AI] Missing probability fields, using defaults");
    return { ...DEFAULT_PROBABILITIES };
  }

  const sum = probs.homeWin + probs.draw + probs.awayWin;

  // Check if probabilities sum to ~1.0 (allow 0.95-1.05 tolerance)
  let normalized = { ...probs };
  if (sum < 0.95 || sum > 1.05) {
    console.warn(`[AI] Probabilities sum to ${sum.toFixed(3)}, normalizing to 1.0`);
    const factor = 1 / sum;
    normalized = {
      homeWin: probs.homeWin * factor,
      draw: probs.draw * factor,
      awayWin: probs.awayWin * factor,
      over15: probs.over15 ?? DEFAULT_PROBABILITIES.over15,
      over25: probs.over25 ?? DEFAULT_PROBABILITIES.over25,
    };
  }

  // Clamp individual probabilities to valid range [0, 1]
  normalized.homeWin = Math.max(0, Math.min(1, normalized.homeWin));
  normalized.draw = Math.max(0, Math.min(1, normalized.draw));
  normalized.awayWin = Math.max(0, Math.min(1, normalized.awayWin));
  normalized.over15 = Math.max(0, Math.min(1, normalized.over15 ?? DEFAULT_PROBABILITIES.over15));
  normalized.over25 = Math.max(0, Math.min(1, normalized.over25 ?? DEFAULT_PROBABILITIES.over25));

  // Warn if any probability is extreme (>85%)
  const maxProb = Math.max(normalized.homeWin, normalized.draw, normalized.awayWin);
  if (maxProb > 0.85) {
    console.warn(`[AI] Extreme probability detected (${(maxProb * 100).toFixed(1)}%), may be overconfident`);
  }

  return normalized;
}

/**
 * Call Groq API for analysis
 */
async function callGroq(prompt: string): Promise<GroqAnalysis> {
  // Default analysis with probabilities so engine can still score
  const defaultAnalysis: GroqAnalysis = {
    narrative: "Unable to generate detailed analysis due to limited data.",
    keyFactors: ["Insufficient data for comprehensive analysis"],
    lean: "HOME",
    confidence: "LOW",
    suggestedMarket: "MATCH_RESULT",
    suggestedOutcome: "Home Win",
    concerns: ["AI analysis unavailable - defaulting to home advantage"],
    probabilities: {
      homeWin: 0.40,
      draw: 0.25,
      awayWin: 0.35,
      over15: 0.55,    // Was 0.65 - reduced to prevent O1.5 bias
      over25: 0.50,    // Was 0.45 - increased for balance
    },
  };

  if (!GROQ_API_KEY) {
    console.warn("GROQ_API_KEY not set, returning default analysis");
    return defaultAnalysis;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an expert football betting analyst with encyclopedic knowledge of European football - Premier League, La Liga, Bundesliga, Serie A, Ligue 1. You know team form, playing styles, managers, key players, injuries, and head-to-head records. When Polymarket data is provided, factor it into your analysis. You MUST always suggest a specific bet. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error(`Groq API error: ${response.status}`);
      return defaultAnalysis;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return defaultAnalysis;
    }

    const parsed = JSON.parse(content);

    // Validate and normalize probabilities
    const validatedProbabilities = validateAndNormalizeProbabilities(parsed.probabilities);

    return {
      narrative: parsed.narrative || defaultAnalysis.narrative,
      keyFactors: parsed.keyFactors || [],
      lean: (parsed.lean as LeanDirection) || "NEUTRAL",
      confidence: (parsed.confidence as ConfidenceLevel) || "LOW",
      suggestedMarket: parsed.suggestedMarket as MarketType | null,
      suggestedOutcome: parsed.suggestedOutcome || null,
      concerns: parsed.concerns || [],
      probabilities: validatedProbabilities,
    };
  } catch (error) {
    console.error("Groq API call failed:", error);
    return defaultAnalysis;
  }
}

/**
 * Call Gemini API for risk flags
 * Per ENGINE_SPEC: Gemini returns only overconfidence, missingContext, cautionLevel
 */
async function callGemini(prompt: string): Promise<GeminiVerification> {
  // Safe defaults when Gemini unavailable - assume incomplete until verified
  const defaultVerification: GeminiVerification = {
    overconfidence: false,     // Don't assume overconfident
    missingContext: true,      // Assume context MIGHT be missing (safer)
    cautionLevel: "mild",      // Apply mild caution when unverified
  };

  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set, skipping verification");
    return defaultVerification;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status}`);
      return defaultVerification;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return defaultVerification;
    }

    const parsed = JSON.parse(content);

    // Validate cautionLevel
    const validCautionLevels = ["none", "mild", "strong"];
    const cautionLevel = validCautionLevels.includes(parsed.cautionLevel)
      ? parsed.cautionLevel
      : "none";

    return {
      overconfidence: Boolean(parsed.overconfidence),
      missingContext: Boolean(parsed.missingContext),
      cautionLevel,
      overconfidenceReason: parsed.overconfidenceReason || undefined,
      missingContextReason: parsed.missingContextReason || undefined,
    };
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return defaultVerification;
  }
}

/**
 * Generate full AI analysis for a fixture
 */
export async function generateAnalysis(
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  lineups: Lineups | null
): Promise<AIAnalysis> {
  const inputHash = generateInputHash(fixture, sentiment, lineups);

  // Generate Groq analysis
  const groqPrompt = buildGroqPrompt(fixture, sentiment, lineups);
  const groqAnalysis = await callGroq(groqPrompt);

  // Verify with Gemini
  const geminiPrompt = buildGeminiPrompt(fixture, groqAnalysis, sentiment);
  const geminiVerification = await callGemini(geminiPrompt);

  return {
    fixtureId: fixture.id,
    generatedAt: nowGMT1(),
    inputHash,
    groqAnalysis,
    geminiVerification,
  };
}

/**
 * Check if analysis should be regenerated based on input changes
 */
export function shouldRegenerateAnalysis(
  existing: AIAnalysis | null,
  fixture: Fixture,
  sentiment: MarketSentiment | null,
  lineups: Lineups | null
): boolean {
  if (!existing) return true;

  const newHash = generateInputHash(fixture, sentiment, lineups);
  return existing.inputHash !== newHash;
}


