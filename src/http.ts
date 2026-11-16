#!/usr/bin/env node
// Remote MCP endpoint — streamable HTTP transport, stateless.
// Each request's `Authorization: Bearer <key>` becomes the ClearSports API key,
// so a hosted deployment serves many users. Falls back to CLEARSPORTS_API_KEY.
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ClearSportsClient } from "./client.js";
import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 8788);
const fallbackKey = process.env.CLEARSPORTS_API_KEY;
const baseUrl = process.env.CLEARSPORTS_API_URL;

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (url.pathname !== "/mcp") {
    res.writeHead(404).end();
    return;
  }

  const auth = req.headers.authorization;
  const apiKey =
    auth?.replace(/^bearer\s+/i, "").trim() || fallbackKey;
  if (!apiKey) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "Missing ClearSports API key. Send Authorization: Bearer <key> or set CLEARSPORTS_API_KEY.",
      }),
    );
    return;
  }

  const body = await new Promise<unknown>((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  }).catch(() => undefined);

  if (body === undefined) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  // Stateless: fresh server + transport per request.
  const server = buildServer(new ClearSportsClient(apiKey, baseUrl));
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
});

http.listen(port, () => {
  console.error(`clearsports-mcp remote endpoint on :${port}/mcp`);
});
