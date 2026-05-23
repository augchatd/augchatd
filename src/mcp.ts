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
  const headers = buildAuthHeaders(c.auth);

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
  const skippedWrites: string[] = [];
  const skippedUnannotated: string[] = [];
  for (const t of listed.tools) {
    if (c.read_only && !isReadOnlyTool(t)) {
      if (t.annotations?.readOnlyHint === false || t.annotations?.destructiveHint === true) {
        skippedWrites.push(t.name);
      } else {
        skippedUnannotated.push(t.name);
      }
      continue;
    }
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
  if (skippedWrites.length > 0) {
    console.log(
      `  mcp[${c.descriptive_id}] read_only=true: skipped ${skippedWrites.length} write tool(s) (server-declared): ${skippedWrites.slice(0, 6).join(", ")}${skippedWrites.length > 6 ? ", …" : ""}`,
    );
  }
  if (skippedUnannotated.length > 0) {
    console.log(
      `  mcp[${c.descriptive_id}] read_only=true: skipped ${skippedUnannotated.length} unannotated tool(s) (no readOnlyHint set): ${skippedUnannotated.slice(0, 6).join(", ")}${skippedUnannotated.length > 6 ? ", …" : ""}`,
    );
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

/**
 * Read-only tool classifier.
 *
 * Trust the MCP server's own declaration via the tool annotations defined in
 * the MCP spec (`readOnlyHint`, `destructiveHint`). No name-based guessing —
 * heuristics produce false positives/negatives and are not a safety boundary.
 *
 * Strict semantics under `read_only: true`:
 *   - Allow only when the server explicitly set `readOnlyHint === true`.
 *   - Block everything else (including unannotated tools and tools where
 *     `destructiveHint === true`).
 *
 * If a server you trust doesn't annotate, fix that server-side. As an escape
 * hatch, set `read_only: false` on the connector to disable the gate
 * entirely — that's the integrator opting in to writes explicitly.
 */
function isReadOnlyTool(t: {
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}): boolean {
  return t.annotations?.readOnlyHint === true;
}

/**
 * Build outbound request headers from the connector's auth object.
 * Accepted shapes (matching the RAG side, see src/rag.ts):
 *   - { bearer: "..." }                  → Authorization: Bearer ...
 *   - { basic: { username, password } }  → Authorization: Basic base64(user:pass)
 *   - { headers: { "X-...": "..." } }    → forwarded as-is (arbitrary header set)
 * Shapes combine: e.g. { bearer, headers } is allowed; later ones win on
 * collision.
 */
function buildAuthHeaders(auth: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof auth.bearer === "string") {
    out["Authorization"] = `Bearer ${auth.bearer}`;
  }
  if (typeof auth.basic === "object" && auth.basic !== null) {
    const b = auth.basic as { username?: unknown; password?: unknown };
    if (typeof b.username === "string" && typeof b.password === "string") {
      const enc = Buffer.from(`${b.username}:${b.password}`).toString("base64");
      out["Authorization"] = `Basic ${enc}`;
    }
  }
  if (typeof auth.headers === "object" && auth.headers !== null) {
    for (const [k, v] of Object.entries(auth.headers as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
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
