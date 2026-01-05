/**
 * Match Selection Filter
 * Determines which fixtures should be analyzed based on:
 * - Big team involvement
 * - High market confidence
 * - Contextual edge
 */

import { isBigTeam } from "@/config/leagues";
import { MARKET_SELECTION_CONFIDENCE_THRESHOLD } from "@/config/constants";
import type { Fixture, MarketSentiment, SelectionReason, SelectedFixture } from "@/types";

interface SelectionResult {
  selected: boolean;
  reason: SelectionReason | null;
}

/**
 * Check if fixture involves a "big team"
 */
function hasBigTeam(fixture: Fixture): boolean {
  return (
    isBigTeam(fixture.leagueCode, fixture.homeTeam.name) ||
    isBigTeam(fixture.leagueCode, fixture.awayTeam.name)
  );
}

/**
 * Check if market shows high confidence (>= 65% on any outcome)
 */
function hasHighMarketConfidence(sentiment: MarketSentiment | null): boolean {
  if (!sentiment?.available || sentiment.markets.length === 0) {
    return false;
  }

  const matchResultMarket = sentiment.markets.find((m) => m.type === "MATCH_RESULT");
  if (!matchResultMarket) return false;

  return matchResultMarket.outcomes.some(
    (o) => o.probability >= MARKET_SELECTION_CONFIDENCE_THRESHOLD
  );
}

/**
 * Determine if a fixture should be selected for analysis
 */
export function shouldSelectFixture(
  fixture: Fixture,
  sentiment: MarketSentiment | null
): SelectionResult {
  // Rule 1: Big team involvement
  if (hasBigTeam(fixture)) {
    return { selected: true, reason: "BIG_TEAM" };
  }

  // Rule 2: High market confidence
  if (hasHighMarketConfidence(sentiment)) {
    return { selected: true, reason: "HIGH_MARKET_CONFIDENCE" };
  }

  // Not selected
  return { selected: false, reason: null };
}

/**
 * Filter fixtures to get selected subset
 */
export function filterSelectedFixtures(
  fixtures: Fixture[],
  sentimentMap: Map<number, MarketSentiment>
): SelectedFixture[] {
  const selected: SelectedFixture[] = [];

  for (const fixture of fixtures) {
    const sentiment = sentimentMap.get(fixture.id) || null;
    const result = shouldSelectFixture(fixture, sentiment);

    if (result.selected && result.reason) {
      selected.push({
        ...fixture,
        selectionReason: result.reason,
      });
    }
  }

  return selected;
}

/**
 * Get selection stats for display
 */
export function getSelectionStats(
  totalFixtures: number,
  selectedFixtures: SelectedFixture[]
) {
  const byReason: Record<SelectionReason, number> = {
    BIG_TEAM: 0,
    HIGH_MARKET_CONFIDENCE: 0,
    CONTEXTUAL_EDGE: 0,
  };

  for (const fixture of selectedFixtures) {
    byReason[fixture.selectionReason]++;
  }

  return {
    total: totalFixtures,
    selected: selectedFixtures.length,
    skipped: totalFixtures - selectedFixtures.length,
    byReason,
  };
}
