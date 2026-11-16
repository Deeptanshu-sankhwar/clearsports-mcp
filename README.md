# clearsports-mcp

MCP server for the [ClearSports API](https://clearsportsapi.com) — odds, scores,
schedules, injuries and player stats for AI agents, over one normalized JSON
schema. NFL, NCAAF, NBA, NCAAB, MLB, NHL and 12 soccer competitions.

## Tools

| Tool | What it returns |
|---|---|
| `get_schedule` | Upcoming games: matchup, UTC time, week, channel |
| `get_scores` | Recent finals + live games in a 1-14 day window |
| `get_team` | Team lookup by name, city or abbreviation |
| `get_injuries` | Current injury report, latest first, optional team filter |
| `get_player_stats` | Season player stats, name/team filters |
| `get_odds` | Pre-game moneyline/spread/total across ~10 US books |

## Local (stdio)

```bash
export CLEARSPORTS_API_KEY=sk_live_...   # https://clearsportsapi.com
npx clearsports-mcp
```

Claude Desktop / Cursor config:

```json
{
  "mcpServers": {
    "clearsports": {
      "command": "npx",
      "args": ["clearsports-mcp"],
      "env": { "CLEARSPORTS_API_KEY": "sk_live_..." }
    }
  }
}
```

## Remote (streamable HTTP)

```bash
CLEARSPORTS_API_KEY=sk_live_... npm run start:http   # PORT=8788 default
```

POST to `/mcp`. The request's `Authorization: Bearer <key>` becomes the
ClearSports key per request, so one hosted instance serves many users; falls
back to `CLEARSPORTS_API_KEY` when no header is present. `GET /health` for
liveness.

## Notes

- Responses are compact agent-shaped objects; upstream provider metadata is
  never forwarded.
- `CLEARSPORTS_API_URL` overrides the API base (default prod).
