#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClearSportsClient } from "./client.js";
import { buildServer } from "./server.js";

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

const transport = new StdioServerTransport();
await buildServer(client).connect(transport);
console.error("clearsports-mcp running on stdio");
