import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClearSportsClient, LEAGUES } from "./client.js";
import {
  filterLeagueRows,
  norm,
  recentGames,
  shapeGame,
  shapeOdds,
  shapeRow,
  upcomingGames,
  unwrapData,
} from "./shape.js";

const leagueSchema = z.enum(LEAGUES).describe(
  "League slug, e.g. nfl, nba, mlb, nhl, epl, mls, laliga, world-cup",
);

function text(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function err(e: unknown) {
  return {
    content: [{ type: "text" as const, text: String(e) }],
    isError: true,
  };
}

export function buildServer(client: ClearSportsClient): McpServer {
  const server = new McpServer({
    name: "clearsports-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_schedule",
    {
      title: "Get schedule",
      description:
        "Upcoming games/fixtures for a league (NFL, NBA, MLB, NHL, NCAAF, NCAAB, soccer leagues). Returns matchup, UTC start time, week and channel.",
      inputSchema: {
        league: leagueSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Max games to return, 1-50"),
      },
    },
    async ({ league, limit }) => {
      try {
        const payload = await client.games(league);
        const games = upcomingGames(unwrapData(payload), limit);
        return text({ league, count: games.length, games: games.map(shapeGame) });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_scores",
    {
      title: "Get scores",
      description:
        "Recent results and live games for a league. Returns matchup, final or current score, and game time.",
      inputSchema: {
        league: leagueSchema,
        days: z
          .number()
          .int()
          .min(1)
          .max(14)
          .default(3)
          .describe("How many days back to look, 1-14"),
        limit: z.number().int().min(1).max(50).default(15),
      },
    },
    async ({ league, days, limit }) => {
      try {
        const payload = await client.games(league);
        const games = recentGames(unwrapData(payload), days, limit);
        return text({ league, count: games.length, games: games.map(shapeGame) });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_team",
    {
      title: "Get team",
      description:
        "Look up a team in a league by name, city, or abbreviation (e.g. 'Chiefs', 'KC', 'Lakers'). Returns the team record.",
      inputSchema: {
        league: leagueSchema,
        team: z
          .string()
          .describe("Team name, city, abbreviation, or team_id like 'nfl_kc'"),
      },
    },
    async ({ league, team }) => {
      try {
        const payload = await client.teams(league);
        const rows = unwrapData<Record<string, unknown>>(payload);
        const q = norm(team);
        const matches = filterLeagueRows(rows, league).filter((t) => {
          const fields = [
            t.team_id, t.abbreviation, t.full_name, t.short_name, t.city,
            ...(Array.isArray(t.aliases) ? t.aliases : []),
          ];
          return fields.some(
            (f) => typeof f === "string" && norm(f).includes(q),
          );
        });
        if (matches.length === 0) {
          return text({ league, team, found: 0, message: "No matching team" });
        }
        return text({
          league,
          found: matches.length,
          teams: matches.slice(0, 5).map(shapeRow),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_injuries",
    {
      title: "Get injuries",
      description:
        "Current injury report for a league or one team. Returns player, team, status, injury type and report date.",
      inputSchema: {
        league: leagueSchema,
        team: z
          .string()
          .optional()
          .describe("Optional team_id like 'nba_lal' to filter to one team"),
        limit: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ league, team, limit }) => {
      try {
        const payload = await client.injuryStats(league, team);
        const rows = filterLeagueRows(
          unwrapData<Record<string, unknown>>(payload),
          league,
        );
        const sorted = [...rows].sort((a, b) =>
          String(b.report_date ?? "").localeCompare(String(a.report_date ?? "")),
        );
        return text({
          league,
          count: sorted.length,
          injuries: sorted.slice(0, limit).map(shapeRow),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_player_stats",
    {
      title: "Get player stats",
      description:
        "Season-level player stats for a league. Optionally filter by team_id or player name (e.g. 'Mahomes', 'James').",
      inputSchema: {
        league: leagueSchema,
        team: z.string().optional().describe("Optional team_id filter"),
        player: z
          .string()
          .optional()
          .describe("Optional player name filter, partial match"),
        limit: z.number().int().min(1).max(100).default(25),
      },
    },
    async ({ league, team, player, limit }) => {
      try {
        const payload = await client.playerStats(league, team);
        let rows = filterLeagueRows(
          unwrapData<Record<string, unknown>>(payload),
          league,
        );
        if (player) {
          const q = norm(player);
          rows = rows.filter(
            (r) =>
              typeof r.full_name === "string" && norm(r.full_name).includes(q),
          );
        }
        return text({
          league,
          count: rows.length,
          players: rows.slice(0, limit).map(shapeRow),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "get_odds",
    {
      title: "Get odds",
      description:
        "Current pre-game odds board for a league: moneyline, spread and totals across ~10 US sportsbooks. Lines are timestamped; pre-game only (not in-play).",
      inputSchema: {
        league: leagueSchema,
        team: z
          .string()
          .optional()
          .describe("Optional team abbreviation filter, e.g. 'KC', 'LAL'"),
        market: z
          .enum(["moneyline", "spread", "total"])
          .optional()
          .describe("Optional: only return one market type"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(5)
          .describe("Max games to return, 1-30"),
      },
    },
    async ({ league, team, market, limit }) => {
      try {
        const payload = await client.gameOdds(league);
        let rows = unwrapData<Record<string, unknown>>(payload);
        if (team) {
          const q = norm(team);
          rows = rows.filter(
            (r) =>
              (typeof r.home_team_abbreviation === "string" &&
                norm(r.home_team_abbreviation) === q) ||
              (typeof r.away_team_abbreviation === "string" &&
                norm(r.away_team_abbreviation) === q),
          );
        }
        const games = shapeOdds(rows as never[], limit).map((g) => ({
          ...g,
          lines: market
            ? g.lines.filter((l) => l.market === market)
            : g.lines,
        }));
        return text({ league, count: games.length, games });
      } catch (e) {
        return err(e);
      }
    },
  );

  return server;
}
