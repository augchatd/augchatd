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
import { writeTraceEvent } from "../trace.ts";
import { getConversation, snapshotActiveMap } from "../conversation-registry.ts";

interface ChatRequestBody {
  /**
   * Thread / conversation id. Required: the client must first call
   * `POST /conversations` to register the id (per contract-connector-toggle).
   */
  id?: string;
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
  if (!body.id || typeof body.id !== "string") {
    return c.json({ error: "missing_conversation_id" }, 400);
  }

  const conversationId = body.id;
  const conversation = getConversation(conversationId, session.session_id);
  if (!conversation) {
    // Per contract-connector-toggle: the conversation must be registered
    // first via POST /conversations. The bundled UI does this on boot.
    return c.json({ error: "conversation_not_found" }, 404);
  }

  // Snapshot at the start of the turn — per contract-session-chat:
  // "active set is captured at the start of each chat turn". In-flight
  // toggles do not affect this turn.
  const activeMap = snapshotActiveMap(conversation, session);

  const mcpConnectors = session.connectors.filter((c) => c.type === "mcp");
  const ragConnectors = session.connectors.filter((c) => c.type === "rag");
  const tools = {
    ...toolsForActiveConnectors(mcpConnectors, activeMap),
    ...toolsForActiveRagConnectors(ragConnectors, activeMap),
  };

  const messages = await convertToModelMessages(body.messages);

  writeTraceEvent(conversationId, {
    type: "request",
    conversation_id: conversationId,
    session_id: session.session_id,
    user_id: session.user_id,
    model: {
      provider: session.model.provider,
      model_id: session.model.model_id,
    },
    system_prompt: session.system_prompt,
    connectors: session.connectors.map((c) => ({
      descriptive_id: c.descriptive_id,
      type: c.type,
      name: c.name,
      default_active: c.default_active,
      active: activeMap.get(c.descriptive_id) ?? c.default_active,
    })),
    messages: body.messages,
  });

  const uiStream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: llmFor(session),
        system: session.system_prompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(MAX_STEPS),
        onStepFinish: (step) => {
          writeTraceEvent(conversationId, {
            type: "step.finish",
            conversation_id: conversationId,
            session_id: session.session_id,
            step_number: step.stepNumber,
            text: step.text,
            reasoning_text: step.reasoningText,
            tool_calls: step.toolCalls,
            tool_results: step.toolResults,
            finish_reason: step.finishReason,
            usage: step.usage,
            warnings: step.warnings,
          });
        },
        onFinish: (event) => {
          writeTraceEvent(conversationId, {
            type: "response.finish",
            conversation_id: conversationId,
            session_id: session.session_id,
            finish_reason: event.finishReason,
            total_usage: event.totalUsage,
            step_count: event.steps.length,
          });
        },
        onError: ({ error }) => {
          writeTraceEvent(conversationId, {
            type: "error",
            conversation_id: conversationId,
            session_id: session.session_id,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        },
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
