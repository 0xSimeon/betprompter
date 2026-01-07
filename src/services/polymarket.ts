/**
 * Polymarket API integration
 * Uses Gamma API for market discovery and CLOB API for prices
 */

import { API_URLS } from "@/config/constants";
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
  outcomes: string;  // JSON string like "[\"Yes\", \"No\"]"
  outcomePrices: string;  // JSON string like "[\"0.705\", \"0.295\"]"
  volume: string;
  clobTokenIds?: string;  // JSON string with token IDs
  sportsMarketType?: string;
}

interface CloBPrice {
  price: string;
}

// League slug prefixes for Polymarket events
const LEAGUE_SLUG_PREFIX: Record<string, string> = {
  PL: "epl",
  PD: "laliga",
  BL1: "bundesliga",
  SA: "serie-a",
  FL1: "ligue-1",
};

// Team name abbreviations for Polymarket slugs
const TEAM_ABBREVIATIONS: Record<string, string> = {
  // Premier League
  "Arsenal FC": "ars",
  "Arsenal": "ars",
  "Liverpool FC": "liv",
  "Liverpool": "liv",
  "Manchester City FC": "mac",
  "Manchester City": "mac",
  "Man City": "mac",
  "Brighton & Hove Albion FC": "bri",
  "Brighton": "bri",
  "Chelsea FC": "che",
  "Chelsea": "che",
  "Manchester United FC": "mau",
  "Manchester United": "mau",
  "Man United": "mau",
  "Tottenham Hotspur FC": "tot",
  "Tottenham": "tot",
  "Spurs": "tot",
  "Newcastle United FC": "new",
  "Newcastle": "new",
  "Aston Villa FC": "avl",
  "Aston Villa": "avl",
  "West Ham United FC": "whu",
  "West Ham": "whu",
  "Nottingham Forest FC": "nfo",
  "Nottingham Forest": "nfo",
  "Fulham FC": "ful",
  "Fulham": "ful",
  "Bournemouth": "bou",
  "AFC Bournemouth": "bou",
  "Crystal Palace FC": "cry",
  "Crystal Palace": "cry",
  "Brentford FC": "bre",
  "Brentford": "bre",
  "Everton FC": "eve",
  "Everton": "eve",
  "Wolverhampton Wanderers FC": "wol",
  "Wolves": "wol",
  "Leicester City FC": "lei",
  "Leicester": "lei",
  "Ipswich Town FC": "ips",
  "Ipswich": "ips",
  "Southampton FC": "sou",
  "Southampton": "sou",
  // La Liga
  "Real Madrid CF": "rma",
  "Real Madrid": "rma",
  "FC Barcelona": "bar",
  "Barcelona": "bar",
  "Atletico Madrid": "atm",
  "Atlético de Madrid": "atm",
  "Sevilla FC": "sev",
  "Sevilla": "sev",
  "Real Sociedad de Fútbol": "rso",
  "Real Sociedad": "rso",
  "Real Betis Balompié": "bet",
  "Real Betis": "bet",
  "Betis": "bet",
  "Villarreal CF": "vil",
  "Villarreal": "vil",
  "Athletic Club": "ath",
  "Athletic Bilbao": "ath",
  "Valencia CF": "val",
  "Valencia": "val",
  "CA Osasuna": "osa",
  "Osasuna": "osa",
  "RC Celta de Vigo": "cel",
  "Celta Vigo": "cel",
  "Celta": "cel",
  "Getafe CF": "get",
  "Getafe": "get",
  "Girona FC": "gir",
  "Girona": "gir",
  "Rayo Vallecano de Madrid": "ray",
  "Rayo Vallecano": "ray",
  "RCD Mallorca": "mal",
  "Mallorca": "mal",
  "UD Las Palmas": "lpa",
  "Las Palmas": "lpa",
  "Deportivo Alavés": "ala",
  "Alavés": "ala",
  "RCD Espanyol de Barcelona": "esp",
  "Espanyol": "esp",
  "CD Leganés": "leg",
  "Leganés": "leg",
  "Real Valladolid CF": "vld",
  "Valladolid": "vld",
  // Bundesliga
  "FC Bayern München": "bay",
  "Bayern Munich": "bay",
  "Bayern": "bay",
  "Borussia Dortmund": "dor",
  "Dortmund": "dor",
  "BVB": "dor",
  "RB Leipzig": "rbl",
  "Leipzig": "rbl",
  "Bayer 04 Leverkusen": "lev",
  "Leverkusen": "lev",
  "VfL Wolfsburg": "wol",
  "Wolfsburg": "wol",
  "Eintracht Frankfurt": "fra",
  "Frankfurt": "fra",
  "VfB Stuttgart": "stu",
  "Stuttgart": "stu",
  "SC Freiburg": "fre",
  "Freiburg": "fre",
  "1. FC Union Berlin": "fcub",
  "Union Berlin": "fcub",
  "TSG 1899 Hoffenheim": "hof",
  "Hoffenheim": "hof",
  "1. FSV Mainz 05": "mai",
  "Mainz": "mai",
  "Borussia Mönchengladbach": "bmg",
  "Gladbach": "bmg",
  "SV Werder Bremen": "wer",
  "Werder Bremen": "wer",
  "FC Augsburg": "aug",
  "Augsburg": "aug",
  "VfL Bochum 1848": "boc",
  "Bochum": "boc",
  "1. FC Heidenheim 1846": "hei",
  "Heidenheim": "hei",
  "FC St. Pauli": "stp",
  "St. Pauli": "stp",
  "Holstein Kiel": "kie",
  "Kiel": "kie",
  // Serie A
  "Juventus FC": "juv",
  "Juventus": "juv",
  "Inter Milan": "int",
  "FC Internazionale Milano": "int",
  "AC Milan": "acm",
  "Milan": "acm",
  "SSC Napoli": "nap",
  "Napoli": "nap",
  "AS Roma": "rom",
  "Roma": "rom",
  "SS Lazio": "laz",
  "Lazio": "laz",
  "Atalanta BC": "ata",
  "Atalanta": "ata",
  "ACF Fiorentina": "fio",
  "Fiorentina": "fio",
  "Bologna FC 1909": "bol",
  "Bologna": "bol",
  "Torino FC": "tor",
  "Torino": "tor",
  "Udinese Calcio": "udi",
  "Udinese": "udi",
  "Genoa CFC": "gen",
  "Genoa": "gen",
  "Cagliari Calcio": "cag",
  "Cagliari": "cag",
  "Parma Calcio 1913": "par",
  "Parma": "par",
  "Empoli FC": "emp",
  "Empoli": "emp",
  "US Lecce": "lec",
  "Lecce": "lec",
  "Como 1907": "com",
  "Como": "com",
  "Hellas Verona FC": "ver",
  "Verona": "ver",
  "Venezia FC": "ven",
  "Venezia": "ven",
  "AC Monza": "mza",
  "Monza": "mza",
  "US Sassuolo Calcio": "sas",
  "Sassuolo": "sas",
  // Ligue 1
  "Paris Saint-Germain FC": "psg",
  "Paris Saint-Germain": "psg",
  "PSG": "psg",
  "AS Monaco FC": "asm",
  "Monaco": "asm",
  "Olympique de Marseille": "mar",
  "Marseille": "mar",
  "Olympique Lyonnais": "lyo",
  "Lyon": "lyo",
  "LOSC Lille": "lil",
  "Lille OSC": "lil",
  "Lille": "lil",
  "OGC Nice": "nic",
  "Nice": "nic",
  "RC Lens": "len",
  "Lens": "len",
  "Stade Rennais FC 1901": "ren",
  "Rennes": "ren",
  "Stade Brestois 29": "bre",
  "Brest": "bre",
  "RC Strasbourg Alsace": "str",
  "Strasbourg": "str",
  "Toulouse FC": "tou",
  "Toulouse": "tou",
  "FC Nantes": "nan",
  "Nantes": "nan",
  "AJ Auxerre": "aux",
  "Auxerre": "aux",
  "Angers SCO": "ang",
  "Angers": "ang",
  "Stade de Reims": "rei",
  "Reims": "rei",
  "Le Havre AC": "leh",
  "Le Havre": "leh",
  "AS Saint-Étienne": "ste",
  "Saint-Étienne": "ste",
  "Montpellier HSC": "mpl",
  "Montpellier": "mpl",
};

/**
 * Get team abbreviation for Polymarket slug
 */
function getTeamAbbrev(teamName: string): string {
  // Check exact match first
  if (TEAM_ABBREVIATIONS[teamName]) {
    return TEAM_ABBREVIATIONS[teamName];
  }

  // Try partial match
  const lowerName = teamName.toLowerCase();
  for (const [key, abbrev] of Object.entries(TEAM_ABBREVIATIONS)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return abbrev;
    }
  }

  // Fallback: first 3 chars of first word
  return teamName.split(/\s+/)[0].slice(0, 3).toLowerCase();
}

/**
 * Construct Polymarket event slug for a fixture
 */
function constructEventSlug(
  leagueCode: string,
  homeTeam: string,
  awayTeam: string,
  kickoffDate: string
): string {
  const prefix = LEAGUE_SLUG_PREFIX[leagueCode] || leagueCode.toLowerCase();
  const homeAbbrev = getTeamAbbrev(homeTeam);
  const awayAbbrev = getTeamAbbrev(awayTeam);
  // Extract date from ISO string (e.g., "2026-01-07T20:00:00+01:00" -> "2026-01-07")
  const date = kickoffDate.split("T")[0];

  return `${prefix}-${homeAbbrev}-${awayAbbrev}-${date}`;
}

/**
 * Fetch event by slug from Polymarket Gamma API
 */
async function fetchEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  try {
    const url = `${API_URLS.POLYMARKET_GAMMA}/events?slug=${slug}`;
    console.log(`[Polymarket] Fetching: ${url}`);

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
  if (sportsMarketType === "btts") {
    return "BTTS";
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
  if (q.includes("over 2.5") || q.includes("more than 2.5") || q.includes("2.5+ goals") || q.includes("3 or more")) {
    return "OVER_2_5";
  }
  if (q.includes("over 1.5") || q.includes("more than 1.5") || q.includes("1.5+ goals") || q.includes("2 or more")) {
    return "OVER_1_5";
  }

  // BTTS detection
  if (q.includes("both teams") && q.includes("score")) {
    return "BTTS";
  }
  if (q.includes("btts")) {
    return "BTTS";
  }

  // Double Chance - less common on Polymarket but check anyway
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
function combineMoneylineMarkets(markets: Market[], homeTeam: string, awayTeam: string): Market | null {
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

    if (q.includes("draw")) {
      outcomeName = "Draw";
    } else if (q.includes(homeTeam.toLowerCase()) || q.includes(getTeamAbbrev(homeTeam))) {
      outcomeName = `${homeTeam} Win`;
    } else if (q.includes(awayTeam.toLowerCase()) || q.includes(getTeamAbbrev(awayTeam))) {
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
    // Construct the expected slug
    const slug = constructEventSlug(
      leagueCode,
      homeTeam,
      awayTeam,
      kickoffDate || new Date().toISOString()
    );
    console.log(`[Polymarket] Looking for event: ${slug}`);

    // Fetch event by slug
    const event = await fetchEventBySlug(slug);

    if (!event) {
      console.log(`[Polymarket] No event found for slug: ${slug}`);
      return {
        fixtureId,
        polymarketEventId: null,
        available: false,
        fetchedAt: nowGMT1(),
        markets: [],
      };
    }

    console.log(`[Polymarket] Found event: ${event.title} with ${event.markets.length} markets`);

    // Map individual markets
    const rawMarkets: Market[] = [];
    for (const pmMarket of event.markets) {
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

    // Add any non-moneyline markets (BTTS, Over/Under, etc.)
    for (const market of rawMarkets) {
      if (market.type !== "MATCH_RESULT") {
        markets.push(market);
      }
    }

    return {
      fixtureId,
      polymarketEventId: event.id,
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
