import type { Context } from "hono";
import type { SessionRecord } from "../session-registry.ts";
import { listProviderModels, type ProviderModel } from "../provider-models.ts";

/**
 * GET /session/models
 *
 * Returns the chat-capable models the session's provider exposes, fetched
 * (and cached per session_id) by hitting the provider's list-models
 * endpoint with the session's key.
 *
 * This is a CONVENIENCE for the bundled UI's model picker; the canonical
 * source of which models the session may use stays with the provider.
 */

interface CacheEntry {
  fetchedAt: number;
  models: ProviderModel[];
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function listSessionModelsHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;
  const key = `${session.session_id}:${session.model.provider}`;
  const cached = cache.get(key);
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  if (fresh) {
    return c.json({ models: cached.models, cached: true });
  }
  try {
    const models = await listProviderModels(
      session.model.provider,
      session.model.api_key,
    );
    cache.set(key, { fetchedAt: Date.now(), models });
    return c.json({ models, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "provider_list_failed", detail: msg }, 502);
  }
}

/** For PUT /conversations/:cid/model to validate the requested id. */
export function lookupKnownModel(
  session: SessionRecord,
  model_id: string,
): ProviderModel | undefined {
  const key = `${session.session_id}:${session.model.provider}`;
  return cache.get(key)?.models.find((m) => m.id === model_id);
}

/** Force-fetch so a PUT can validate even before any GET has happened. */
export async function ensureModelsCached(session: SessionRecord): Promise<ProviderModel[]> {
  const key = `${session.session_id}:${session.model.provider}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.models;
  const models = await listProviderModels(
    session.model.provider,
    session.model.api_key,
  );
  cache.set(key, { fetchedAt: Date.now(), models });
  return models;
}
