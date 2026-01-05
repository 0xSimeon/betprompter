/**
 * Polymarket API integration
 * Uses Gamma API for market discovery and CLOB API for prices
 */

import { API_URLS } from "@/config/constants";
import { LEAGUE_LIST } from "@/config/leagues";
import { nowGMT1 } from "@/lib/date";
import type { MarketSentiment, Market, MarketOutcome } from "@/types";
import type { MarketType } from "@/config/markets";

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  active: boolean;
  closed: boolean;
  markets: PolymarketMarket[];
}

interface PolymarketMarket {
  id: string;
  question: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
  }>;
}

interface CloBPrice {
  price: string;
}

/**
 * Fetch events from Polymarket Gamma API for a specific league
 */
async function fetchSportsEvents(polymarketLeagueId: number): Promise<PolymarketEvent[]> {
  try {
    const url = `${API_URLS.POLYMARKET_GAMMA}/events?active=true&closed=false&series_id=${polymarketLeagueId}&limit=50`;

    const response = await fetch(url, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Polymarket API error: ${response.status}`);
      return [];
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch Polymarket events:", error);
    return [];
  }
}

/**
 * Fetch current price for a token from CLOB API
 */
async function fetchTokenPrice(tokenId: string): Promise<number | null> {
  try {
    const url = `${API_URLS.POLYMARKET_CLOB}/price?token_id=${tokenId}&side=buy`;

    const response = await fetch(url, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const data: CloBPrice = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error(`Failed to fetch price for token ${tokenId}:`, error);
    return null;
  }
}

/**
 * Normalize team name for fuzzy matching
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/fc|cf|sc|ac|as|ss|rb|1\./gi, "")
    .replace(/[^a-z]/g, "")
    .trim();
}

/**
 * Check if event title matches fixture teams
 */
function eventMatchesFixture(
  eventTitle: string,
  homeTeam: string,
  awayTeam: string
): boolean {
  const normalizedTitle = normalizeTeamName(eventTitle);
  const normalizedHome = normalizeTeamName(homeTeam);
  const normalizedAway = normalizeTeamName(awayTeam);

  // Check if both team names appear in the event title
  return (
    normalizedTitle.includes(normalizedHome) &&
    normalizedTitle.includes(normalizedAway)
  );
}

/**
 * Determine market type from question text
 */
function inferMarketType(question: string): MarketType | null {
  const q = question.toLowerCase();

  if (q.includes("who will win") || q.includes("match result") || q.includes("winner")) {
    return "MATCH_RESULT";
  }
  if (q.includes("over 2.5") || q.includes("more than 2.5")) {
    return "OVER_2_5";
  }
  if (q.includes("over 1.5") || q.includes("more than 1.5")) {
    return "OVER_1_5";
  }

  return null;
}

/**
 * Map Polymarket market to our Market type
 */
async function mapPolymarketMarket(
  pmMarket: PolymarketMarket
): Promise<Market | null> {
  const marketType = inferMarketType(pmMarket.question);
  if (!marketType) return null;

  // Parse outcome prices from the API response
  const outcomes: MarketOutcome[] = [];

  for (let i = 0; i < pmMarket.outcomes.length; i++) {
    const outcomeName = pmMarket.outcomes[i];
    const priceStr = pmMarket.outcomePrices[i];
    const tokenId = pmMarket.tokens?.[i]?.token_id || "";

    // Price is already a probability (0-1)
    const probability = parseFloat(priceStr);

    outcomes.push({
      name: outcomeName,
      probability: isNaN(probability) ? 0 : probability,
      tokenId,
    });
  }

  return {
    type: marketType,
    question: pmMarket.question,
    volume: parseFloat(pmMarket.volume) || 0,
    outcomes,
  };
}

/**
 * Fetch market sentiment for a fixture
 */
export async function fetchSentimentForFixture(
  fixtureId: number,
  homeTeam: string,
  awayTeam: string,
  leagueCode: string
): Promise<MarketSentiment> {
  const league = LEAGUE_LIST.find((l) => l.code === leagueCode);

  if (!league) {
    return {
      fixtureId,
      polymarketEventId: null,
      available: false,
      fetchedAt: nowGMT1(),
      markets: [],
    };
  }

  try {
    // Fetch events for this league
    const events = await fetchSportsEvents(league.polymarketId);

    // Find matching event
    const matchingEvent = events.find((event) =>
      eventMatchesFixture(event.title, homeTeam, awayTeam)
    );

    if (!matchingEvent) {
      return {
        fixtureId,
        polymarketEventId: null,
        available: false,
        fetchedAt: nowGMT1(),
        markets: [],
      };
    }

    // Map markets
    const markets: Market[] = [];

    for (const pmMarket of matchingEvent.markets) {
      const market = await mapPolymarketMarket(pmMarket);
      if (market) {
        markets.push(market);
      }
    }

    return {
      fixtureId,
      polymarketEventId: matchingEvent.id,
      available: markets.length > 0,
      fetchedAt: nowGMT1(),
      markets,
    };
  } catch (error) {
    console.error(`Failed to fetch sentiment for fixture ${fixtureId}:`, error);
    return {
      fixtureId,
      polymarketEventId: null,
      available: false,
      fetchedAt: nowGMT1(),
      markets: [],
    };
  }
}

/**
 * Refresh prices for a sentiment object
 */
export async function refreshSentimentPrices(
  sentiment: MarketSentiment
): Promise<MarketSentiment> {
  if (!sentiment.available || sentiment.markets.length === 0) {
    return sentiment;
  }

  const updatedMarkets: Market[] = [];

  for (const market of sentiment.markets) {
    const updatedOutcomes: MarketOutcome[] = [];

    for (const outcome of market.outcomes) {
      if (outcome.tokenId) {
        const newPrice = await fetchTokenPrice(outcome.tokenId);
        updatedOutcomes.push({
          ...outcome,
          probability: newPrice !== null ? newPrice : outcome.probability,
        });
      } else {
        updatedOutcomes.push(outcome);
      }
    }

    updatedMarkets.push({
      ...market,
      outcomes: updatedOutcomes,
    });
  }

  return {
    ...sentiment,
    fetchedAt: nowGMT1(),
    markets: updatedMarkets,
  };
}
