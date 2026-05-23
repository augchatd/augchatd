/**
 * List the chat-capable models for a given provider, hitting the
 * provider's own list-models endpoint with the session's key.
 *
 * Returned shape is provider-agnostic so the UI doesn't need to
 * special-case. Cached per-session at the call-site.
 */

export interface ProviderModel {
  /** Canonical id used when calling the provider (also what augchatd stores). */
  id: string;
  /** Friendly label for the UI (may equal id when the provider has no display name). */
  display_name: string;
  provider: string;
}

export async function listProviderModels(
  provider: string,
  apiKey: string,
): Promise<ProviderModel[]> {
  switch (provider) {
    case "openai":
      return listOpenAIModels(apiKey);
    case "anthropic":
      return listAnthropicModels(apiKey);
    default:
      throw new Error(`Unsupported provider for model listing: ${provider}`);
  }
}

interface OpenAIListResponse {
  data: Array<{ id: string; owned_by?: string }>;
}

async function listOpenAIModels(apiKey: string): Promise<ProviderModel[]> {
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) {
    throw new Error(`openai list models: HTTP ${r.status}`);
  }
  const j = (await r.json()) as OpenAIListResponse;
  // Filter to chat-capable models. OpenAI's /v1/models also returns
  // embeddings, tts, whisper, dall-e, moderation, legacy completion —
  // none of which work with chat.completions. Prefix heuristic: gpt-*,
  // chatgpt-*, o1*, o3*, o4*, o5*.
  const chatRe = /^(gpt-|chatgpt-|o[1-9])/;
  return j.data
    .filter((m) => chatRe.test(m.id))
    // Drop date-stamped snapshots (e.g. gpt-4o-2024-08-06) — they
    // clutter the picker and the aliased version (gpt-4o) is the
    // recommended one.
    .filter((m) => !/-\d{4}-\d{2}-\d{2}$/.test(m.id))
    // Drop audio/preview/realtime variants that aren't useful for chat.
    .filter((m) => !/-audio|-realtime|-search-preview/.test(m.id))
    .map((m) => ({ id: m.id, display_name: m.id, provider: "openai" }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

interface AnthropicListResponse {
  data: Array<{ id: string; display_name?: string; type?: string }>;
}

async function listAnthropicModels(apiKey: string): Promise<ProviderModel[]> {
  const r = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!r.ok) {
    throw new Error(`anthropic list models: HTTP ${r.status}`);
  }
  const j = (await r.json()) as AnthropicListResponse;
  return j.data
    .map((m) => ({
      id: m.id,
      display_name: m.display_name ?? m.id,
      provider: "anthropic",
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
