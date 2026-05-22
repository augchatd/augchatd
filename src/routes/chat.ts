import type { Context } from "hono";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { llmFor } from "../llm.ts";
import { toolsForActiveConnectors } from "../mcp.ts";
import type { SessionRecord } from "../session-registry.ts";

interface ChatRequestBody {
  messages: UIMessage[];
}

/**
 * POST /chat — chat tool-use loop (partial, per contract-session-chat).
 *
 * Wired today:
 *   - JWT bearer auth (requireSession middleware).
 *   - Session's model + key.
 *   - Tools from active MCP-type connectors (default_active=true today;
 *     per-conversation toggling lands with conversation persistence).
 *   - Vercel AI SDK handles the multi-step tool-use loop:
 *     stopWhen: stepCountIs(N) caps depth.
 *
 * Not yet wired:
 *   - Conversation persistence (no conversation_id routing yet).
 *   - RAG-type connectors (no retrieval dispatch yet).
 *   - Read-only mode signaling (no cold flush, no stall).
 */
export async function chatHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;

  let body: ChatRequestBody;
  try {
    body = (await c.req.json()) as ChatRequestBody;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "missing_messages" }, 400);
  }

  const mcpConnectors = session.connectors.filter((c) => c.type === "mcp");
  const tools = toolsForActiveConnectors(mcpConnectors);

  const result = streamText({
    model: llmFor(session),
    system: session.system_prompt,
    messages: await convertToModelMessages(body.messages),
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    // Multi-step tool-use loop: after a tool returns, feed the result
    // back so the LLM can write a final assistant message. Cap depth
    // to bound runaway tool-calling.
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
