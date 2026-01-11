/**
 * Static league configuration
 * Maps Football-Data.org competition IDs to Polymarket series IDs
 */

export interface LeagueConfig {
  id: string;
  name: string;
  code: string;
  country: string;
  footballDataId: number;
  polymarketId: number;
  bigTeams: string[];
}

export const LEAGUES: Record<string, LeagueConfig> = {
  EPL: {
    id: "epl",
    name: "English Premier League",
    code: "EPL",
    country: "England",
    footballDataId: 2021,
    polymarketId: 10188, // Correct series ID from /sports endpoint
    bigTeams: [
      "Arsenal FC",
      "Chelsea FC",
      "Liverpool FC",
      "Manchester City FC",
      "Manchester United FC",
      "Tottenham Hotspur FC",
    ],
  },
  LALIGA: {
    id: "laliga",
    name: "La Liga",
    code: "LALIGA",
    country: "Spain",
    footballDataId: 2014,
    polymarketId: 10193, // Correct series ID from /sports endpoint
    bigTeams: [
      "Real Madrid CF",
      "FC Barcelona",
      "Club Atlético de Madrid",
      "Athletic Club",
      "Real Sociedad de Fútbol",
    ],
  },
  BUNDESLIGA: {
    id: "bundesliga",
    name: "Bundesliga",
    code: "BL1",
    country: "Germany",
    footballDataId: 2002,
    polymarketId: 10194, // Correct series ID from /sports endpoint
    bigTeams: [
      "FC Bayern München",
      "Borussia Dortmund",
      "RB Leipzig",
      "Bayer 04 Leverkusen",
    ],
  },
  SERIE_A: {
    id: "serie-a",
    name: "Serie A",
    code: "SA",
    country: "Italy",
    footballDataId: 2019,
    polymarketId: 10203, // Correct series ID from /sports endpoint
    bigTeams: [
      "Juventus FC",
      "FC Internazionale Milano",
      "AC Milan",
      "SSC Napoli",
      "AS Roma",
      "SS Lazio",
    ],
  },
  LIGUE_1: {
    id: "ligue-1",
    name: "Ligue 1",
    code: "FL1",
    country: "France",
    footballDataId: 2015,
    polymarketId: 10195, // Correct series ID from /sports endpoint
    bigTeams: [
      "Paris Saint-Germain FC",
      "AS Monaco FC",
      "Olympique de Marseille",
      "Olympique Lyonnais",
      "LOSC Lille",
    ],
  },
  // Per ENGINE_SPEC: Champions League is a supported competition
  UCL: {
    id: "ucl",
    name: "UEFA Champions League",
    code: "CL",
    country: "Europe",
    footballDataId: 2001,
    polymarketId: 10204, // Correct series ID from /sports endpoint
    bigTeams: [
      "Real Madrid CF",
      "FC Barcelona",
      "FC Bayern München",
      "Manchester City FC",
      "Liverpool FC",
      "Paris Saint-Germain FC",
      "FC Internazionale Milano",
      "Juventus FC",
      "Arsenal",
      "Chelsea FC",
      "Manchester City FC",
    ],
  },
};

export const LEAGUE_LIST = Object.values(LEAGUES);

export const FOOTBALL_DATA_IDS = LEAGUE_LIST.map((l) => l.footballDataId);

export function getLeagueByFootballDataId(id: number): LeagueConfig | undefined {
  return LEAGUE_LIST.find((l) => l.footballDataId === id);
}

export function getLeagueByCode(code: string): LeagueConfig | undefined {
  return LEAGUES[code] || LEAGUE_LIST.find((l) => l.code === code);
}

export function isBigTeam(leagueCode: string, teamName: string): boolean {
  const league = getLeagueByCode(leagueCode);
  if (!league) return false;

  // Fuzzy match: check if team name contains any big team name or vice versa
  return league.bigTeams.some(
    (bigTeam) =>
      teamName.toLowerCase().includes(bigTeam.toLowerCase()) ||
      bigTeam.toLowerCase().includes(teamName.toLowerCase())
  );
}
