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
  let prompt = `Analyze this football match and provide betting insights.

MATCH: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}
LEAGUE: ${fixture.leagueCode}
KICKOFF: ${fixture.kickoff}
VENUE: ${fixture.venue || "Unknown"}
`;

  if (sentiment?.available && sentiment.markets.length > 0) {
    prompt += `
MARKET SENTIMENT (Polymarket):
`;
    for (const market of sentiment.markets) {
      prompt += `${market.question}\n`;
      for (const outcome of market.outcomes) {
        prompt += `  - ${outcome.name}: ${(outcome.probability * 100).toFixed(1)}%\n`;
      }
      prompt += `  Volume: $${market.volume.toLocaleString()}\n`;
    }
  } else {
    prompt += `
MARKET SENTIMENT: Not available for this fixture.
`;
  }

  if (lineups?.available) {
    prompt += `
LINEUPS AVAILABLE: Yes
Home formation: ${lineups.home?.formation || "Unknown"}
Away formation: ${lineups.away?.formation || "Unknown"}
`;
  }

  prompt += `
TASK:
You are an expert football analyst. Provide a betting analysis with PROBABILITY ESTIMATES.

USE YOUR KNOWLEDGE:
- Team strengths, recent form (last 5 matches), playing styles
- Managerial changes, key injuries, suspensions
- Home/away performance patterns, head-to-head records
- Tactical matchups, motivation (title race, relegation battle, cup focus)

COMPARE WITH POLYMARKET (if available):
- If your probability differs from market by >10%, that's a potential VALUE bet
- High volume markets (>$10k) are more reliable signals
- Note if you agree or disagree with market sentiment

OUTPUT REQUIREMENTS:
1. Narrative: 2-3 sentences explaining your KEY ANGLE
2. Key Factors: 3-5 SPECIFIC factors (actual stats, news, not generic)
3. Lean: HOME, DRAW, or AWAY
4. Confidence: HIGH (>70% certain), MEDIUM (55-70%), LOW (<55%)
5. Suggested Market & Outcome
6. Concerns: Specific risks
7. PROBABILITIES: Your estimated probability for EACH outcome (must sum correctly)

Respond in this EXACT JSON format:
{
  "narrative": "string",
  "keyFactors": ["string", "string", ...],
  "lean": "HOME" | "DRAW" | "AWAY",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "suggestedMarket": "MATCH_RESULT" | "DOUBLE_CHANCE" | "OVER_1_5" | "OVER_2_5" | "BTTS",
  "suggestedOutcome": "string",
  "concerns": ["string", ...],
  "probabilities": {
    "homeWin": 0.xx,
    "draw": 0.xx,
    "awayWin": 0.xx,
    "over15": 0.xx,
    "over25": 0.xx,
    "btts": 0.xx
  }
}

PROBABILITY GUIDELINES:
- homeWin + draw + awayWin should equal ~1.0
- Strong favorites at home: 55-75% win probability
- Evenly matched: 30-40% each for home/away, 25-30% draw
- Be realistic - even dominant teams rarely exceed 80%`;

  return prompt;
}

/**
 * Build prompt for Gemini verification
 */
function buildGeminiPrompt(
  fixture: Fixture,
  groqAnalysis: GroqAnalysis,
  sentiment: MarketSentiment | null
): string {
  return `Review this AI-generated football analysis for quality and accuracy.

MATCH: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}

ANALYSIS:
Narrative: ${groqAnalysis.narrative}
Lean: ${groqAnalysis.lean}
Confidence: ${groqAnalysis.confidence}
Suggested: ${groqAnalysis.suggestedMarket} - ${groqAnalysis.suggestedOutcome}
Key Factors: ${groqAnalysis.keyFactors.join(", ")}

${sentiment?.available ? `Market probability for suggested outcome: Check against sentiment data.` : "No market data available."}

TASK:
Identify any issues:
1. Contradictions in the reasoning
2. Missing important context
3. Overconfidence flags (e.g., HIGH confidence without strong supporting factors)

Respond in JSON:
{
  "contradictions": ["string", ...],
  "missingContext": ["string", ...],
  "overconfidenceFlags": ["string", ...],
  "passed": boolean
}

Be critical. Flag anything that seems overconfident or poorly reasoned.`;
}

/**
 * Call Groq API for analysis
 */
async function callGroq(prompt: string): Promise<GroqAnalysis> {
  const defaultAnalysis: GroqAnalysis = {
    narrative: "Unable to generate detailed analysis due to limited data.",
    keyFactors: ["Insufficient data for comprehensive analysis"],
    lean: "HOME",
    confidence: "LOW",
    suggestedMarket: "MATCH_RESULT",
    suggestedOutcome: "Home Win",
    concerns: ["AI analysis unavailable - defaulting to home advantage"],
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

    return {
      narrative: parsed.narrative || defaultAnalysis.narrative,
      keyFactors: parsed.keyFactors || [],
      lean: (parsed.lean as LeanDirection) || "NEUTRAL",
      confidence: (parsed.confidence as ConfidenceLevel) || "LOW",
      suggestedMarket: parsed.suggestedMarket as MarketType | null,
      suggestedOutcome: parsed.suggestedOutcome || null,
      concerns: parsed.concerns || [],
      probabilities: parsed.probabilities || undefined,
    };
  } catch (error) {
    console.error("Groq API call failed:", error);
    return defaultAnalysis;
  }
}

/**
 * Call Gemini API for verification
 */
async function callGemini(prompt: string): Promise<GeminiVerification> {
  const defaultVerification: GeminiVerification = {
    contradictions: [],
    missingContext: [],
    overconfidenceFlags: [],
    passed: true,
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
            maxOutputTokens: 2000, // Increased for Gemini 3's internal thinking tokens
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

    return {
      contradictions: parsed.contradictions || [],
      missingContext: parsed.missingContext || [],
      overconfidenceFlags: parsed.overconfidenceFlags || [],
      passed: parsed.passed !== false,
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
