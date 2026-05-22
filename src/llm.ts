import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { SessionRecord } from "./session-registry.ts";

/**
 * Build a Vercel AI SDK LanguageModel for the session's configured
 * provider + model + key.
 *
 * Per adr-0006-vercel-ai-sdk-for-llm: provider plug-ins are selected
 * per session by the `model.provider` field in the setup payload. Each
 * supported provider adds a `case` branch with its constructor.
 */
export function llmFor(session: SessionRecord): LanguageModel {
  const { provider, model_id, api_key } = session.model;
  switch (provider) {
    case "anthropic": {
      const client = createAnthropic({ apiKey: api_key });
      return client(model_id);
    }
    case "openai": {
      const client = createOpenAI({ apiKey: api_key });
      return client(model_id);
    }
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}
