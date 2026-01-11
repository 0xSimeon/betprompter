/**
 * Application constants
 * All times referenced in GMT+1 (Nigeria timezone)
 */

// Timezone
export const TIMEZONE = "Africa/Lagos"; // GMT+1
export const TIMEZONE_OFFSET_HOURS = 1;

// Classification thresholds
export const BANKER_PROBABILITY_THRESHOLD = 0.7; // 70%
export const VALUE_PROBABILITY_MIN = 0.4; // 40%
export const VALUE_PROBABILITY_MAX = 0.6; // 60%
export const MARKET_SELECTION_CONFIDENCE_THRESHOLD = 0.65; // 65% for non-big-team selection

// Refresh intervals (in minutes)
export const LINEUP_REFRESH_WINDOW_START = 55; // minutes before kickoff
export const LINEUP_REFRESH_WINDOW_END = 50; // minutes before kickoff
export const SENTIMENT_CACHE_TTL = 30; // minutes

// KV TTLs (in seconds)
export const KV_TTL = {
  FIXTURES_DAILY: 24 * 60 * 60, // 24 hours
  FIXTURE_SINGLE: 48 * 60 * 60, // 48 hours
  LINEUPS: 24 * 60 * 60, // 24 hours
  SENTIMENT: 48 * 60 * 60, // 48 hours - persist through prematch
  ANALYSIS: 24 * 60 * 60, // Until kickoff, but max 24h
  PREDICTION: 48 * 60 * 60, // 48 hours
} as const;

// API rate limits (requests per period)
export const RATE_LIMITS = {
  FOOTBALL_DATA: {
    requests: 10,
    periodSeconds: 60, // 10 req/min
  },
  POLYMARKET_GAMMA: {
    requests: 500,
    periodSeconds: 10, // 500 req/10s for /events
  },
  POLYMARKET_CLOB: {
    requests: 1500,
    periodSeconds: 10, // 1500 req/10s for /price
  },
} as const;

// External API base URLs
export const API_URLS = {
  FOOTBALL_DATA: "https://api.football-data.org/v4",
  POLYMARKET_GAMMA: "https://gamma-api.polymarket.com",
  POLYMARKET_CLOB: "https://clob.polymarket.com",
} as const;

// Disclaimer text
export const DISCLAIMER =
  "This website is for informational purposes only. It is not betting advice. Betting involves risk. As usual, no crying in the casino.";

export const ATTRIBUTION = "Built with ❤️ by Simeon Udoh";
