const DEFAULT_BASE_URL = "https://api.clearsportsapi.com";

export const LEAGUES = [
  "nfl", "ncaaf", "nba", "ncaab", "nhl", "mlb",
  "epl", "laliga", "bundesliga", "mls", "ligue1",
  "ligaportugal", "uefa", "eredivisie", "seriea",
  "ligamx", "brazilian-serie-a", "world-cup",
] as const;

export type League = (typeof LEAGUES)[number];

export class ClearSportsClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = DEFAULT_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `ClearSports API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`,
      );
    }
    return res.json();
  }

  games(league: League) {
    return this.get(`/api/v1/${league}/games`);
  }

  teams(league: League) {
    return this.get(`/api/v1/${league}/teams`);
  }

  team(league: League, teamId: string) {
    return this.get(`/api/v1/${league}/teams/${encodeURIComponent(teamId)}`);
  }

  injuryStats(league: League, teamId?: string) {
    const q = teamId ? `?team_id=${encodeURIComponent(teamId)}` : "";
    return this.get(`/api/v1/${league}/injury-stats${q}`);
  }

  playerStats(league: League, teamId?: string) {
    const q = teamId ? `?team_id=${encodeURIComponent(teamId)}` : "";
    return this.get(`/api/v1/${league}/player-stats${q}`);
  }
}
