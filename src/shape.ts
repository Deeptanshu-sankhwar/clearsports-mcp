// Compact shapes for agent consumption.
// IMPORTANT: never forward `data_source` or other upstream-provider fields —
// see clearsports-api-server issue #55.

interface ApiGame {
  game_key?: string;
  week?: number | null;
  season?: number;
  season_type?: string;
  time_utc?: string;
  status?: string;
  channel?: string | null;
  home_team_abbreviation?: string;
  away_team_abbreviation?: string;
  home_score?: number;
  away_score?: number;
  is_closed?: boolean;
  canceled?: boolean;
}

export function shapeGame(g: ApiGame) {
  const game: Record<string, unknown> = {
    matchup: `${g.away_team_abbreviation} @ ${g.home_team_abbreviation}`,
    time_utc: g.time_utc,
    status: g.status,
  };
  if (g.is_closed || g.status === "FINAL") {
    game.score = `${g.away_team_abbreviation} ${g.away_score}, ${g.home_team_abbreviation} ${g.home_score}`;
  }
  if (g.week != null) game.week = g.week;
  if (g.season != null) game.season = g.season;
  if (g.season_type != null) game.season_type = g.season_type;
  if (g.channel) game.channel = g.channel;
  if (g.canceled) game.canceled = true;
  return game;
}

export function upcomingGames(
  games: ApiGame[],
  limit: number,
): ApiGame[] {
  const now = Math.floor(Date.now() / 1000);
  const withEpoch = games as (ApiGame & { epoch_time?: number })[];
  return withEpoch
    .filter((g) => (g.epoch_time ?? 0) >= now && !g.is_closed && !g.canceled)
    .sort((a, b) => (a.epoch_time ?? 0) - (b.epoch_time ?? 0))
    .slice(0, limit);
}

export function unwrapData(payload: unknown): ApiGame[] {
  // API responses wrap rows under a collection key, e.g. { count, games: [...] }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const v of Object.values(payload)) {
      if (Array.isArray(v)) return v as ApiGame[];
    }
    return [];
  }
  return Array.isArray(payload) ? (payload as ApiGame[]) : [];
}
