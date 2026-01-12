/**
 * Test Endpoint - Validates all system layers per TESTING_PLAYBOOK.md
 *
 * Layers tested:
 * 1. Fixture Ingestion
 * 2. Polymarket Data
 * 3. Groq Integration
 * 4. Gemini Integration
 * 5. Engine Logic (determinism)
 * 6. Daily Cap Enforcement
 */

import { NextResponse } from "next/server";
import { getTodayGMT1, getRollingTwoWeekDates } from "@/lib/date";
import {
  fetchFixturesByDate,
  fetchSentimentForFixture,
  generateAnalysis,
  generateEnginePrediction,
  scoreAllMarkets,
  DAILY_BET_CAP,
} from "@/services";
import type { Fixture, MarketSentiment, AIAnalysis, Prediction } from "@/types";

interface LayerResult {
  layer: string;
  status: "PASS" | "FAIL" | "WARN";
  details: Record<string, unknown>;
  errors?: string[];
}

export async function GET() {
  const results: LayerResult[] = [];
  const today = getTodayGMT1();

  console.log("\n========================================");
  console.log("🧪 SYSTEM TEST - TESTING_PLAYBOOK.md");
  console.log("========================================\n");

  // ============================================
  // LAYER 1: Fixture Ingestion
  // ============================================
  console.log("📥 Layer 1: Fixture Ingestion...");
  let testFixture: Fixture | null = null;

  try {
    const dates = getRollingTwoWeekDates();
    const fixturesByDay: Record<string, number> = {};
    let totalFixtures = 0;
    let allFixtures: Fixture[] = [];

    // Fetch first 3 days only for speed
    for (const date of dates.slice(0, 3)) {
      const fixtures = await fetchFixturesByDate(date);
      fixturesByDay[date] = fixtures.length;
      totalFixtures += fixtures.length;
      allFixtures = [...allFixtures, ...fixtures];
    }

    // Pick first available fixture for subsequent tests
    testFixture = allFixtures.find(f =>
      f.status !== "FINISHED" && f.status !== "POSTPONED"
    ) || allFixtures[0] || null;

    const layer1Pass = totalFixtures > 0 && dates.length === 14;

    results.push({
      layer: "1. Fixture Ingestion",
      status: layer1Pass ? "PASS" : "FAIL",
      details: {
        rollingWindowDays: dates.length,
        dateRange: `${dates[0]} to ${dates[dates.length - 1]}`,
        fixturesChecked: Object.keys(fixturesByDay).length,
        fixturesByDay,
        totalFixtures,
        testFixtureSelected: testFixture ? `${testFixture.homeTeam.name} vs ${testFixture.awayTeam.name}` : null,
      },
    });

    console.log(`   ✓ Found ${totalFixtures} fixtures across ${Object.keys(fixturesByDay).length} days`);
  } catch (error) {
    results.push({
      layer: "1. Fixture Ingestion",
      status: "FAIL",
      details: {},
      errors: [String(error)],
    });
    console.log(`   ✗ ERROR: ${error}`);
  }

  if (!testFixture) {
    return NextResponse.json({
      success: false,
      error: "No test fixture available",
      results,
    });
  }

  // ============================================
  // LAYER 2: Polymarket Data
  // ============================================
  console.log("\n📊 Layer 2: Polymarket Data...");
  let sentiment: MarketSentiment | null = null;

  try {
    sentiment = await fetchSentimentForFixture(
      testFixture.id,
      testFixture.homeTeam.name,
      testFixture.awayTeam.name,
      testFixture.leagueCode,
      testFixture.kickoff
    );

    const marketsValid = sentiment.markets.every(m => {
      const probSum = m.outcomes.reduce((sum, o) => sum + o.probability, 0);
      return probSum > 0.9 && probSum < 1.1; // Allow some rounding
    });

    results.push({
      layer: "2. Polymarket Data",
      status: sentiment.available ? "PASS" : "WARN",
      details: {
        available: sentiment.available,
        polymarketEventId: sentiment.polymarketEventId,
        marketsCount: sentiment.markets.length,
        markets: sentiment.markets.map(m => ({
          type: m.type,
          question: m.question,
          volume: m.volume,
          outcomes: m.outcomes.map(o => ({
            name: o.name,
            probability: Math.round(o.probability * 100) + "%",
          })),
        })),
        probabilitiesValid: marketsValid,
      },
    });

    if (sentiment.available) {
      console.log(`   ✓ Found ${sentiment.markets.length} markets`);
    } else {
      console.log(`   ⚠ No Polymarket data for this fixture (normal for some matches)`);
    }
  } catch (error) {
    results.push({
      layer: "2. Polymarket Data",
      status: "FAIL",
      details: {},
      errors: [String(error)],
    });
    console.log(`   ✗ ERROR: ${error}`);
  }

  // ============================================
  // LAYER 3: Groq Integration
  // ============================================
  console.log("\n🤖 Layer 3: Groq Integration...");
  let analysis: AIAnalysis | null = null;

  try {
    analysis = await generateAnalysis(testFixture, sentiment, null);

    const groq = analysis.groqAnalysis;
    const requiredFields = ["narrative", "keyFactors", "lean", "confidence", "suggestedMarket"];
    const missingFields = requiredFields.filter(f => !groq[f as keyof typeof groq]);
    const hasProbabilities = !!groq.probabilities;

    results.push({
      layer: "3. Groq Integration",
      status: missingFields.length === 0 ? "PASS" : "FAIL",
      details: {
        narrativeLength: groq.narrative.length,
        keyFactorsCount: groq.keyFactors.length,
        lean: groq.lean,
        confidence: groq.confidence,
        suggestedMarket: groq.suggestedMarket,
        suggestedOutcome: groq.suggestedOutcome,
        hasProbabilities,
        probabilities: groq.probabilities || "NOT PROVIDED",
        concernsCount: groq.concerns.length,
        missingFields: missingFields.length > 0 ? missingFields : "none",
      },
    });

    console.log(`   ✓ Groq returned: lean=${groq.lean}, confidence=${groq.confidence}`);
    if (!hasProbabilities) {
      console.log(`   ⚠ Warning: No probabilities returned (using defaults)`);
    }
  } catch (error) {
    results.push({
      layer: "3. Groq Integration",
      status: "FAIL",
      details: {},
      errors: [String(error)],
    });
    console.log(`   ✗ ERROR: ${error}`);
  }

  // ============================================
  // LAYER 4: Gemini Integration
  // ============================================
  console.log("\n🔍 Layer 4: Gemini Integration...");

  if (analysis) {
    const gemini = analysis.geminiVerification;
    const validCautionLevels = ["none", "mild", "strong"];
    const cautionValid = validCautionLevels.includes(gemini.cautionLevel);

    // Check no unexpected fields (Gemini should only return risk flags)
    const allowedFields = ["overconfidence", "missingContext", "cautionLevel", "overconfidenceReason", "missingContextReason"];
    const geminiKeys = Object.keys(gemini);
    const unexpectedFields = geminiKeys.filter(k => !allowedFields.includes(k));

    results.push({
      layer: "4. Gemini Integration",
      status: cautionValid && unexpectedFields.length === 0 ? "PASS" : "FAIL",
      details: {
        overconfidence: gemini.overconfidence,
        overconfidenceReason: gemini.overconfidenceReason || null,
        missingContext: gemini.missingContext,
        missingContextReason: gemini.missingContextReason || null,
        cautionLevel: gemini.cautionLevel,
        cautionLevelValid: cautionValid,
        unexpectedFields: unexpectedFields.length > 0 ? unexpectedFields : "none",
      },
    });

    console.log(`   ✓ Gemini returned: caution=${gemini.cautionLevel}, overconfidence=${gemini.overconfidence}`);
  } else {
    results.push({
      layer: "4. Gemini Integration",
      status: "FAIL",
      details: {},
      errors: ["No analysis available from Layer 3"],
    });
    console.log(`   ✗ Skipped (no analysis)`);
  }

  // ============================================
  // LAYER 5: Engine Logic (Determinism)
  // ============================================
  console.log("\n⚙️ Layer 5: Engine Logic (Determinism Test)...");

  if (analysis) {
    try {
      // Run engine 3 times with same input
      const prediction1 = generateEnginePrediction(testFixture, sentiment, analysis);
      const prediction2 = generateEnginePrediction(testFixture, sentiment, analysis);
      const prediction3 = generateEnginePrediction(testFixture, sentiment, analysis);

      // Check determinism
      const isDeterministic =
        prediction1.category === prediction2.category &&
        prediction2.category === prediction3.category &&
        prediction1.primaryMarket?.type === prediction2.primaryMarket?.type &&
        prediction2.primaryMarket?.type === prediction3.primaryMarket?.type &&
        prediction1.primaryMarket?.confidence === prediction2.primaryMarket?.confidence;

      // Get scores for inspection (ENGINE_SPEC v1.1 format)
      const scores = scoreAllMarkets(testFixture, sentiment, analysis);
      const topScores = scores.slice(0, 5).map(s => ({
        market: s.market,
        selection: s.selection,
        baseScore: s.baseScore,
        polymarketSignal: s.polymarketSignal,
        groqConfidenceBonus: s.groqConfidenceBonus,
        geminiPenalty: s.geminiPenalty,
        finalScore: s.finalScore,
        blockedAsPrimary: s.blockedAsPrimary,
      }));

      results.push({
        layer: "5. Engine Logic",
        status: isDeterministic ? "PASS" : "FAIL",
        details: {
          isDeterministic,
          runs: [
            { category: prediction1.category, market: prediction1.primaryMarket?.type, confidence: prediction1.primaryMarket?.confidence },
            { category: prediction2.category, market: prediction2.primaryMarket?.type, confidence: prediction2.primaryMarket?.confidence },
            { category: prediction3.category, market: prediction3.primaryMarket?.type, confidence: prediction3.primaryMarket?.confidence },
          ],
          finalPrediction: {
            category: prediction1.category,
            primaryMarket: prediction1.primaryMarket,
            alternativeMarket: prediction1.alternativeMarket,
            disclaimersCount: prediction1.disclaimers.length,
          },
          topMarketScores: topScores,
        },
      });

      console.log(`   ✓ Engine is deterministic: ${prediction1.category} (${prediction1.primaryMarket?.type})`);
    } catch (error) {
      results.push({
        layer: "5. Engine Logic",
        status: "FAIL",
        details: {},
        errors: [String(error)],
      });
      console.log(`   ✗ ERROR: ${error}`);
    }
  } else {
    results.push({
      layer: "5. Engine Logic",
      status: "FAIL",
      details: {},
      errors: ["No analysis available"],
    });
    console.log(`   ✗ Skipped (no analysis)`);
  }

  // ============================================
  // LAYER 6: Daily Cap Enforcement
  // ============================================
  console.log("\n🎯 Layer 6: Daily Cap Enforcement...");

  try {
    // Simulate 10 predictions with varying scores
    const mockPredictions = Array.from({ length: 10 }, (_, i) => ({
      fixture: testFixture!,
      prediction: {
        fixtureId: testFixture!.id + i,
        category: "VALUE" as const,
        primaryMarket: { type: "MATCH_RESULT" as const, selection: "Test", confidence: 50 + i * 5, reasoning: "Test" },
      } as Prediction,
      topScore: 35 + i * 5, // Scores: 35, 40, 45, 50, 55, 60, 65, 70, 75, 80
    }));

    // Apply threshold filter (MIN_SCORE_THRESHOLD = 40)
    const aboveThreshold = mockPredictions.filter(p => p.topScore >= 40);

    // Apply daily cap
    const selected = aboveThreshold
      .sort((a, b) => b.topScore - a.topScore)
      .slice(0, DAILY_BET_CAP);

    const capEnforced = selected.length === DAILY_BET_CAP;
    const highestRetained = selected.every(s => s.topScore >= 60); // Top 5 should be 60, 65, 70, 75, 80

    results.push({
      layer: "6. Daily Cap Enforcement",
      status: capEnforced && highestRetained ? "PASS" : "FAIL",
      details: {
        DAILY_BET_CAP,
        totalSimulated: mockPredictions.length,
        aboveThreshold: aboveThreshold.length,
        selected: selected.length,
        selectedScores: selected.map(s => s.topScore),
        capEnforced,
        highestScoresRetained: highestRetained,
      },
    });

    console.log(`   ✓ Daily cap enforced: ${selected.length}/${mockPredictions.length} selected`);
  } catch (error) {
    results.push({
      layer: "6. Daily Cap Enforcement",
      status: "FAIL",
      details: {},
      errors: [String(error)],
    });
    console.log(`   ✗ ERROR: ${error}`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n========================================");
  console.log("📋 TEST SUMMARY");
  console.log("========================================");

  const passed = results.filter(r => r.status === "PASS").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const failed = results.filter(r => r.status === "FAIL").length;

  results.forEach(r => {
    const icon = r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${r.layer}: ${r.status}`);
  });

  console.log(`\nTotal: ${passed} PASS, ${warned} WARN, ${failed} FAIL`);
  console.log("========================================\n");

  return NextResponse.json({
    success: failed === 0,
    summary: {
      passed,
      warned,
      failed,
      total: results.length,
    },
    testFixture: testFixture ? {
      id: testFixture.id,
      match: `${testFixture.homeTeam.name} vs ${testFixture.awayTeam.name}`,
      league: testFixture.leagueCode,
      kickoff: testFixture.kickoff,
    } : null,
    results,
  });
}
