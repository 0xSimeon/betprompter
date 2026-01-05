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
Provide a concise analysis with:
1. A 2-3 sentence narrative explaining the key angle for this match
2. 3-5 key factors that could influence the outcome
3. Your lean (HOME, DRAW, AWAY, or NEUTRAL if no clear edge)
4. Confidence level (HIGH, MEDIUM, LOW)
5. Suggested market (MATCH_RESULT, DOUBLE_CHANCE, OVER_1_5, OVER_2_5, or null if no bet)
6. Suggested outcome for that market (e.g., "Home Win", "1X", "Over 2.5")
7. Any concerns or caveats

Respond in this exact JSON format:
{
  "narrative": "string",
  "keyFactors": ["string", "string", ...],
  "lean": "HOME" | "DRAW" | "AWAY" | "NEUTRAL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "suggestedMarket": "MATCH_RESULT" | "DOUBLE_CHANCE" | "OVER_1_5" | "OVER_2_5" | null,
  "suggestedOutcome": "string" | null,
  "concerns": ["string", ...]
}

Be conservative and honest. Express uncertainty when warranted. Do not overstate edges.`;

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
    narrative: "Unable to generate analysis.",
    keyFactors: [],
    lean: "NEUTRAL",
    confidence: "LOW",
    suggestedMarket: null,
    suggestedOutcome: null,
    concerns: ["AI analysis unavailable"],
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
            content: "You are a football betting analyst. Provide structured, honest analysis. Always respond with valid JSON.",
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
            maxOutputTokens: 500,
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
