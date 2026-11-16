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

export function recentGames(
  games: ApiGame[],
  days: number,
  limit: number,
): ApiGame[] {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - days * 86400;
  const withEpoch = games as (ApiGame & { epoch_time?: number })[];
  return withEpoch
    .filter(
      (g) =>
        (g.epoch_time ?? 0) <= now &&
        (g.epoch_time ?? 0) >= cutoff &&
        !g.canceled,
    )
    .sort((a, b) => (b.epoch_time ?? 0) - (a.epoch_time ?? 0))
    .slice(0, limit);
}

// Fields that must never reach the client — upstream provider metadata
// (issue #55) plus DB bookkeeping noise.
const STRIP = new Set([
  "id", "data_source", "source_url", "logo_url", "player_image",
  "created_date", "updated_date", "sport", "league",
]);

export function shapeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!STRIP.has(k) && v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

// Normalize for cross-league id/label matching (nba_* ids, NBA label, etc.)
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Some endpoints leak rows from other leagues (issue #28). Keep rows whose
// league field or team_id matches the requested league.
export function filterLeagueRows(
  rows: Record<string, unknown>[],
  league: string,
): Record<string, unknown>[] {
  const target = norm(league);
  return rows.filter((r) => {
    const lg = typeof r.league === "string" ? norm(r.league) : "";
    const tid = typeof r.team_id === "string" ? norm(r.team_id) : "";
    return lg === target || tid.startsWith(target) || tid.includes(`_${target}_`);
  });
}

export function unwrapData<T = ApiGame>(payload: unknown): T[] {
  // API responses wrap rows under a collection key, e.g. { count, games: [...] }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const v of Object.values(payload)) {
      if (Array.isArray(v)) return v as T[];
    }
    return [];
  }
  return Array.isArray(payload) ? (payload as T[]) : [];
}
