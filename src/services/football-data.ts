/**
 * Football-Data.org API integration
 * https://www.football-data.org/documentation/api
 */

import { API_URLS, TIMEZONE } from "@/config/constants";
import { LEAGUE_LIST, getLeagueByFootballDataId } from "@/config/leagues";
import { utcToGMT1 } from "@/lib/date";
import type { Fixture, Lineups, Player, FixtureStatus } from "@/types";

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || "";

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  venue: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  competition: {
    id: number;
    name: string;
    code: string;
  };
}

interface FootballDataLineup {
  id: number;
  name: string;
  position: string | null;
  shirtNumber: number | null;
}

interface FootballDataMatchDetail {
  id: number;
  homeTeam: {
    lineup: FootballDataLineup[];
    formation: string | null;
  };
  awayTeam: {
    lineup: FootballDataLineup[];
    formation: string | null;
  };
}

function mapStatus(status: string): FixtureStatus {
  const statusMap: Record<string, FixtureStatus> = {
    SCHEDULED: "SCHEDULED",
    TIMED: "TIMED",
    LIVE: "LIVE",
    IN_PLAY: "IN_PLAY",
    PAUSED: "PAUSED",
    FINISHED: "FINISHED",
    POSTPONED: "POSTPONED",
    CANCELLED: "CANCELLED",
    SUSPENDED: "SUSPENDED",
  };
  return statusMap[status] || "SCHEDULED";
}

function mapMatch(match: FootballDataMatch): Fixture {
  const league = getLeagueByFootballDataId(match.competition.id);

  return {
    id: match.id,
    leagueCode: league?.code || match.competition.code,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      crest: match.homeTeam.crest,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      crest: match.awayTeam.crest,
    },
    kickoff: utcToGMT1(match.utcDate),
    venue: match.venue,
    matchday: match.matchday,
    status: mapStatus(match.status),
    score: {
      home: match.score.fullTime.home,
      away: match.score.fullTime.away,
    },
  };
}

async function fetchFromApi<T>(endpoint: string): Promise<T> {
  const url = `${API_URLS.FOOTBALL_DATA}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": API_KEY,
    },
    next: { revalidate: 0 }, // No caching
  });

  if (!response.ok) {
    throw new Error(`Football-Data API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch fixtures for a specific date across all top 5 leagues
 */
export async function fetchFixturesByDate(date: string): Promise<Fixture[]> {
  const competitionIds = LEAGUE_LIST.map((l) => l.footballDataId).join(",");

  const data = await fetchFromApi<{ matches: FootballDataMatch[] }>(
    `/matches?competitions=${competitionIds}&dateFrom=${date}&dateTo=${date}`
  );

  return data.matches.map(mapMatch);
}

/**
 * Fetch a single fixture by ID
 */
export async function fetchFixtureById(fixtureId: number): Promise<Fixture | null> {
  try {
    const data = await fetchFromApi<FootballDataMatch>(`/matches/${fixtureId}`);
    return mapMatch(data);
  } catch (error) {
    console.error(`Failed to fetch fixture ${fixtureId}:`, error);
    return null;
  }
}

/**
 * Fetch lineups for a fixture
 */
export async function fetchLineups(fixtureId: number): Promise<Lineups> {
  try {
    const data = await fetchFromApi<FootballDataMatchDetail>(`/matches/${fixtureId}`);

    const hasLineups =
      data.homeTeam.lineup?.length > 0 || data.awayTeam.lineup?.length > 0;

    const mapPlayers = (players: FootballDataLineup[]): Player[] =>
      players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        shirtNumber: p.shirtNumber,
      }));

    return {
      fixtureId,
      fetchedAt: new Date().toISOString(),
      available: hasLineups,
      home: hasLineups
        ? {
            formation: data.homeTeam.formation,
            players: mapPlayers(data.homeTeam.lineup || []),
          }
        : null,
      away: hasLineups
        ? {
            formation: data.awayTeam.formation,
            players: mapPlayers(data.awayTeam.lineup || []),
          }
        : null,
    };
  } catch (error) {
    console.error(`Failed to fetch lineups for ${fixtureId}:`, error);
    return {
      fixtureId,
      fetchedAt: new Date().toISOString(),
      available: false,
      home: null,
      away: null,
    };
  }
}

/**
 * Fetch final score for a fixture
 */
export async function fetchFinalScore(
  fixtureId: number
): Promise<{ home: number; away: number } | null> {
  try {
    const fixture = await fetchFixtureById(fixtureId);
    if (
      fixture &&
      fixture.status === "FINISHED" &&
      fixture.score.home !== null &&
      fixture.score.away !== null
    ) {
      return {
        home: fixture.score.home,
        away: fixture.score.away,
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch final score for ${fixtureId}:`, error);
    return null;
  }
}
