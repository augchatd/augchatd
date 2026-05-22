/**
 * Mock MCP server for testing connectors in demo mode.
 *
 * Pattern follows the official SDK example
 * (node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/honoWebStandardStreamableHttp.js):
 * stateless — fresh McpServer + transport per HTTP request. Independent
 * clients (e.g. augchatd restarting) reconnect freely without session
 * state to manage.
 *
 * Run with:
 *   bun run scripts/mock-mcp-server.ts
 *
 * Tools:
 *   - echo(text)             — returns the input verbatim
 *   - random_number(max?)    — returns a random integer in [0, max]
 *   - current_time()         — returns the server's current ISO timestamp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.MOCK_MCP_PORT ?? 9000);

function buildServer(): McpServer {
  const mcp = new McpServer(
    { name: "mock-mcp-server", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  mcp.registerTool(
    "echo",
    {
      description: "Echo back the input text. Useful as a smoke test.",
      inputSchema: { text: z.string().describe("Text to echo back") },
    },
    async ({ text }) => ({
      content: [{ type: "text", text }],
    }),
  );

  mcp.registerTool(
    "random_number",
    {
      description: "Return a random integer in the inclusive range [0, max].",
      inputSchema: {
        max: z.number().int().min(0).default(100).describe("Upper bound (inclusive)"),
      },
    },
    async ({ max }) => ({
      content: [
        { type: "text", text: String(Math.floor(Math.random() * (max + 1))) },
      ],
    }),
  );

  mcp.registerTool(
    "current_time",
    {
      description: "Return the server's current time as an ISO 8601 timestamp.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text", text: new Date().toISOString() }],
    }),
  );

  return mcp;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== "/mcp") {
      return new Response("Not found. MCP endpoint is /mcp", { status: 404 });
    }
    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = buildServer();
    await server.connect(transport);
    return transport.handleRequest(req);
  },
});

console.log(`mock MCP server on http://localhost:${PORT}/mcp (stateless)`);
console.log(`tools: echo, random_number, current_time`);
