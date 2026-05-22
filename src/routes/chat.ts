import type { Context } from "hono";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { llmFor } from "../llm.ts";
import type { SessionRecord } from "../session-registry.ts";

interface ChatRequestBody {
  messages: UIMessage[];
}

/**
 * POST /chat — minimal first cut of the chat tool-use loop.
 *
 * Per contract-session-chat (partial today):
 *   - JWT-authenticated (Bearer; requireSession middleware sets the
 *     session record on the context before this handler runs).
 *   - Streams the LLM reply as a UIMessage stream — assistant-ui's
 *     native protocol per adr-0006-vercel-ai-sdk-for-llm.
 *   - Uses the session's provisioned model + api key (in demo, the one
 *     bound at process boot from env).
 *
 * Not yet wired (deliberate scope for this slice):
 *   - Conversation persistence (no hot SQLite, no conversation_id
 *     routing) — replies are stateless until storage lands.
 *   - Connector dispatch (no MCP/RAG tools exposed yet).
 *   - Read-only mode signaling (no flush, so no stall to surface).
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

  const result = streamText({
    model: llmFor(session),
    system: session.system_prompt,
    messages: await convertToModelMessages(body.messages),
  });

  return result.toUIMessageStreamResponse();
}
