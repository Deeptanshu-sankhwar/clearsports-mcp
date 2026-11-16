#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ClearSportsClient, LEAGUES } from "./client.js";
import { shapeGame, upcomingGames, unwrapData } from "./shape.js";

const apiKey = process.env.CLEARSPORTS_API_KEY;
if (!apiKey) {
  console.error(
    "CLEARSPORTS_API_KEY is not set. Get a key at https://clearsportsapi.com",
  );
  process.exit(1);
}

const client = new ClearSportsClient(
  apiKey,
  process.env.CLEARSPORTS_API_URL, // optional override, defaults to prod
);

const server = new McpServer({
  name: "clearsports-mcp",
  version: "0.1.0",
});

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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("clearsports-mcp running on stdio");
