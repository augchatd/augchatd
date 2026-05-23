import type { Context } from "hono";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  type UIMessage,
} from "ai";
import { llmFor } from "../llm.ts";
import { toolsForActiveConnectors } from "../mcp.ts";
import { toolsForActiveRagConnectors } from "../rag.ts";
import type { SessionRecord } from "../session-registry.ts";

interface ChatRequestBody {
  messages: UIMessage[];
}

// Tool-use loop depth. Generous (100) so paginated MCP flows can fetch
// all slices on their own — augchatd does not nudge the LLM to "answer
// with partial data" or be lazy about pagination. If the cap genuinely
// hits, the fallback below makes the truncation visible to the user.
const MAX_STEPS = 100;

/**
 * POST /chat — chat tool-use loop (partial, per contract-session-chat).
 *
 * Wired today:
 *   - JWT bearer auth (requireSession middleware sets `session` on ctx).
 *   - Session's model + key.
 *   - Tools from active MCP-type and RAG-type connectors merged into
 *     a single tool map.
 *   - Multi-step tool-use loop capped at MAX_STEPS via
 *     `stopWhen: stepCountIs(...)`. When the cap hits and the LLM
 *     hasn't produced a final text message yet, we inject a
 *     visible fallback into the UI stream so the user sees something
 *     (instead of a chat that just stops emitting after a flurry of
 *     tool calls).
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
  const ragConnectors = session.connectors.filter((c) => c.type === "rag");
  const tools = {
    ...toolsForActiveConnectors(mcpConnectors),
    ...toolsForActiveRagConnectors(ragConnectors),
  };

  const messages = await convertToModelMessages(body.messages);

  const uiStream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: llmFor(session),
        system: session.system_prompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(MAX_STEPS),
      });

      writer.merge(result.toUIMessageStream());

      // After the model stream completes, inspect why it stopped.
      // If we hit the step cap mid-tool-loop, emit a fallback text
      // part — otherwise the user sees a chat that ran a bunch of
      // tools and produced no message.
      const finishReason = await result.finishReason;
      if (finishReason === "tool-calls") {
        const id = `augchatd-fallback-${Date.now()}`;
        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta:
            `\n\n⚠ augchatd: hit the tool-use depth limit (${MAX_STEPS} steps) without a final answer. ` +
            `The retrieved data above is partial. Try a more specific question, or ask the assistant ` +
            `to summarize what it has so far.`,
        });
        writer.write({ type: "text-end", id });
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}
