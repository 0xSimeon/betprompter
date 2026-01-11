/**
 * Polymarket API integration
 * Uses Gamma API with series_id for match discovery
 * Uses CLOB API for live prices
 */

import { API_URLS } from "@/config/constants";
import { getLeagueByCode } from "@/config/leagues";
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
  outcomes: string; // JSON string like "[\"Yes\", \"No\"]"
  outcomePrices: string; // JSON string like "[\"0.705\", \"0.295\"]"
  volume: string;
  clobTokenIds?: string; // JSON string with token IDs
  sportsMarketType?: string;
}

interface CloBPrice {
  price: string;
}

/**
 * Normalize team name for fuzzy matching
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/fc|cf|sc|ac|as|ss|rb|1\.|afc/gi, "")
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
 * Fetch events from Polymarket by series_id
 */
async function fetchEventsBySeries(seriesId: number): Promise<PolymarketEvent[]> {
  try {
    const url = `${API_URLS.POLYMARKET_GAMMA}/events?series_id=${seriesId}&active=true&closed=false&_limit=50`;
    console.log(`[Polymarket] Fetching events: ${url}`);

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
 * Fetch event by slug from Polymarket Gamma API
 */
async function fetchEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  try {
    const url = `${API_URLS.POLYMARKET_GAMMA}/events?slug=${slug}`;
    console.log(`[Polymarket] Fetching by slug: ${url}`);

    const response = await fetch(url, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Polymarket API error: ${response.status}`);
      return null;
    }

    const events: PolymarketEvent[] = await response.json();
    return events.length > 0 ? events[0] : null;
  } catch (error) {
    console.error(`Failed to fetch Polymarket event ${slug}:`, error);
    return null;
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
 * Determine market type from question text or sportsMarketType
 */
function inferMarketType(question: string, sportsMarketType?: string): MarketType | null {
  // Use sportsMarketType if available (more reliable)
  if (sportsMarketType === "moneyline") {
    return "MATCH_RESULT";
  }
  if (sportsMarketType === "totals") {
    const q = question.toLowerCase();
    if (q.includes("2.5")) return "OVER_2_5";
    if (q.includes("1.5")) return "OVER_1_5";
  }
  // Per ENGINE_SPEC: BTTS is not a supported market - skip it
  if (sportsMarketType === "btts") {
    return null;
  }

  const q = question.toLowerCase();

  // Match result detection
  if (q.includes("will") && q.includes("win")) {
    return "MATCH_RESULT";
  }
  if (q.includes("draw")) {
    return "MATCH_RESULT";
  }

  // Goals markets
  if (
    q.includes("over 2.5") ||
    q.includes("more than 2.5") ||
    q.includes("2.5+ goals") ||
    q.includes("3 or more")
  ) {
    return "OVER_2_5";
  }
  if (
    q.includes("over 1.5") ||
    q.includes("more than 1.5") ||
    q.includes("1.5+ goals") ||
    q.includes("2 or more")
  ) {
    return "OVER_1_5";
  }

  // Double Chance
  if (q.includes("double chance") || q.includes("not lose")) {
    return "DOUBLE_CHANCE";
  }

  return null;
}

/**
 * Map Polymarket market to our Market type
 */
function mapPolymarketMarket(pmMarket: PolymarketMarket): Market | null {
  const marketType = inferMarketType(pmMarket.question, pmMarket.sportsMarketType);
  if (!marketType) return null;

  // Parse JSON strings for outcomes and prices
  let outcomeNames: string[];
  let outcomePrices: string[];
  let tokenIds: string[] = [];

  try {
    outcomeNames = JSON.parse(pmMarket.outcomes);
    outcomePrices = JSON.parse(pmMarket.outcomePrices);
    if (pmMarket.clobTokenIds) {
      tokenIds = JSON.parse(pmMarket.clobTokenIds);
    }
  } catch {
    console.error("Failed to parse market data:", pmMarket.question);
    return null;
  }

  const outcomes: MarketOutcome[] = [];

  for (let i = 0; i < outcomeNames.length; i++) {
    const probability = parseFloat(outcomePrices[i]) || 0;

    outcomes.push({
      name: outcomeNames[i],
      probability,
      tokenId: tokenIds[i] || "",
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
 * Combine multiple moneyline markets into a single MATCH_RESULT market
 * Polymarket has separate markets for "Home Win", "Draw", "Away Win"
 */
function combineMoneylineMarkets(
  markets: Market[],
  homeTeam: string,
  awayTeam: string
): Market | null {
  const moneylineMarkets = markets.filter(
    (m) => m.type === "MATCH_RESULT" && m.outcomes.length === 2
  );

  if (moneylineMarkets.length < 2) return null;

  const outcomes: MarketOutcome[] = [];
  let totalVolume = 0;

  for (const market of moneylineMarkets) {
    const yesOutcome = market.outcomes.find((o) => o.name === "Yes");
    if (!yesOutcome) continue;

    totalVolume += market.volume;

    // Determine outcome name from question
    const q = market.question.toLowerCase();
    let outcomeName = "Unknown";

    const normalizedHome = normalizeTeamName(homeTeam);
    const normalizedAway = normalizeTeamName(awayTeam);
    const normalizedQ = normalizeTeamName(q);

    if (q.includes("draw")) {
      outcomeName = "Draw";
    } else if (normalizedQ.includes(normalizedHome)) {
      outcomeName = `${homeTeam} Win`;
    } else if (normalizedQ.includes(normalizedAway)) {
      outcomeName = `${awayTeam} Win`;
    }

    outcomes.push({
      name: outcomeName,
      probability: yesOutcome.probability,
      tokenId: yesOutcome.tokenId,
    });
  }

  if (outcomes.length < 2) return null;

  return {
    type: "MATCH_RESULT",
    question: `Match Result: ${homeTeam} vs ${awayTeam}`,
    volume: totalVolume,
    outcomes: outcomes.sort((a, b) => b.probability - a.probability),
  };
}

/**
 * Fetch market sentiment for a fixture
 */
export async function fetchSentimentForFixture(
  fixtureId: number,
  homeTeam: string,
  awayTeam: string,
  leagueCode: string,
  kickoffDate?: string
): Promise<MarketSentiment> {
  try {
    // Get league config for polymarketId
    const league = getLeagueByCode(leagueCode);
    if (!league || league.polymarketId === 0) {
      console.log(`[Polymarket] No polymarketId for league ${leagueCode}`);
      return {
        fixtureId,
        polymarketEventId: null,
        available: false,
        fetchedAt: nowGMT1(),
        markets: [],
      };
    }

    // Fetch all events for this league series
    const events = await fetchEventsBySeries(league.polymarketId);
    console.log(`[Polymarket] Found ${events.length} events for series ${league.polymarketId}`);

    // Find event matching our fixture
    let matchedEvent: PolymarketEvent | null = null;
    for (const event of events) {
      if (eventMatchesFixture(event.title, homeTeam, awayTeam)) {
        matchedEvent = event;
        console.log(`[Polymarket] Matched event: ${event.title} (${event.slug})`);
        break;
      }
    }

    if (!matchedEvent) {
      console.log(`[Polymarket] No event found for ${homeTeam} vs ${awayTeam}`);
      return {
        fixtureId,
        polymarketEventId: null,
        available: false,
        fetchedAt: nowGMT1(),
        markets: [],
      };
    }

    console.log(
      `[Polymarket] Found event: ${matchedEvent.title} with ${matchedEvent.markets.length} markets`
    );

    // Map individual markets
    const rawMarkets: Market[] = [];
    for (const pmMarket of matchedEvent.markets) {
      const market = mapPolymarketMarket(pmMarket);
      if (market) {
        rawMarkets.push(market);
      }
    }

    // Combine moneyline markets into a single MATCH_RESULT
    const combinedMatchResult = combineMoneylineMarkets(rawMarkets, homeTeam, awayTeam);

    const markets: Market[] = [];
    if (combinedMatchResult) {
      markets.push(combinedMatchResult);
    }

    // Add any non-moneyline markets (Over/Under, Double Chance)
    for (const market of rawMarkets) {
      if (market.type !== "MATCH_RESULT") {
        markets.push(market);
      }
    }

    return {
      fixtureId,
      polymarketEventId: matchedEvent.id,
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
