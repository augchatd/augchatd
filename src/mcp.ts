import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { jsonSchema, tool, type Tool } from "ai";
import type { McpConnector } from "./connectors.ts";

/**
 * MCP integration for augchatd.
 *
 * Per contract-mcp-invocation: for each active MCP-type connector, augchatd
 * connects to that connector's HTTP/SSE URL with its credentials, lists the
 * server's tools, and exposes those tools to the LLM at chat time.
 *
 * For this first wiring we keep a single global MCP client + tool cache per
 * connector (keyed by descriptive_id). Connections are eager at boot: if a
 * connector's server is down, we log and continue (per the principle
 * articulated on issue augchatd/augchatd#5 — required deps are validated at
 * setup, optional deps fail at use time).
 */

interface ConnectedMcp {
  connector: McpConnector;
  client: Client;
  tools: Record<string, Tool>;
}

const connected = new Map<string, ConnectedMcp>();

export async function initMcpConnectors(connectors: McpConnector[]): Promise<void> {
  for (const c of connectors) {
    try {
      const conn = await connectMcp(c);
      connected.set(c.descriptive_id, conn);
      const toolNames = Object.keys(conn.tools);
      console.log(
        `  mcp[${c.descriptive_id}] connected, tools: ${toolNames.length ? toolNames.join(", ") : "(none)"}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  mcp[${c.descriptive_id}] connect failed: ${msg}`);
      // Skip — optional dependency. Chat still works without this connector.
    }
  }
}

async function connectMcp(c: McpConnector): Promise<ConnectedMcp> {
  const headers: Record<string, string> = {};
  const bearer = typeof c.auth.bearer === "string" ? c.auth.bearer : undefined;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;

  const transport = new StreamableHTTPClientTransport(new URL(c.url), {
    requestInit: { headers },
  });

  const client = new Client(
    { name: "augchatd", version: "0.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);

  const listed = await client.listTools();
  const tools: Record<string, Tool> = {};
  for (const t of listed.tools) {
    const namespaced = `${c.descriptive_id}__${t.name}`;
    tools[namespaced] = tool({
      description: t.description ?? `MCP tool ${t.name} (via ${c.descriptive_id})`,
      inputSchema: jsonSchema(t.inputSchema as object),
      execute: async (input) => {
        const result = (await client.callTool({
          name: t.name,
          arguments: input as Record<string, unknown>,
        })) as unknown;
        return flattenResult(result);
      },
    });
  }

  return { connector: c, client, tools };
}

/**
 * Tools exposed to the LLM for the current turn, filtered by the active set.
 * For the demo mode in this slice there's no per-conversation active map yet,
 * so we use each connector's `default_active`. When conversation persistence
 * lands, this signature takes the conversation's saved active map.
 */
export function toolsForActiveConnectors(connectors: McpConnector[]): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const c of connectors) {
    if (!c.default_active) continue;
    const entry = connected.get(c.descriptive_id);
    if (!entry) continue;
    Object.assign(out, entry.tools);
  }
  return out;
}

function flattenResult(result: unknown): string {
  // MCP CallToolResult is { content: [{type:"text",text:"..."},{type:"image",...}] }
  // or, for legacy servers, { toolResult: <anything> }.
  if (typeof result !== "object" || result === null) return JSON.stringify(result);
  const r = result as { content?: unknown; toolResult?: unknown };
  if (Array.isArray(r.content)) {
    const texts = (r.content as Array<Record<string, unknown>>)
      .filter((c) => c["type"] === "text" && typeof c["text"] === "string")
      .map((c) => c["text"] as string);
    if (texts.length > 0) return texts.join("\n");
    return JSON.stringify(r.content);
  }
  if (r.toolResult !== undefined) return JSON.stringify(r.toolResult);
  return JSON.stringify(result);
}
