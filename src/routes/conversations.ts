import type { Context } from "hono";
import type { SessionRecord } from "../session-registry.ts";
import {
  createConversation,
  getConversation,
  listConnectorsForConversation,
  setConnectorActive,
  setConversationModel,
} from "../conversation-registry.ts";
import { ensureModelsCached } from "./models.ts";

/**
 * Conversation + per-conversation connector toggle endpoints.
 *
 * Spec: contract-connector-toggle + the two technical contracts
 * (http-get-conversation-connectors, http-put-conversation-connector-state).
 *
 * Storage is in-memory for now (see conversation-registry.ts header).
 */

/**
 * POST /conversations
 *
 * Body (optional): `{ conversation_id?: string }`. If supplied (e.g. the
 * assistant-ui-generated thread id), the registry binds to that id;
 * otherwise a UUID is minted. Idempotent on `conversation_id`.
 *
 * Returns `201 { conversation_id }`.
 */
export async function createConversationHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;

  let requestedId: string | undefined;
  // Body is optional. Tolerate empty or absent body.
  const ct = c.req.header("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await c.req.json()) as { conversation_id?: unknown };
      if (body && body.conversation_id !== undefined) {
        if (typeof body.conversation_id !== "string" || body.conversation_id.length === 0) {
          return c.json({ error: "invalid_conversation_id" }, 400);
        }
        requestedId = body.conversation_id;
      }
    } catch {
      // empty body w/ json content-type — treat as no requestedId
    }
  }

  let record;
  try {
    record = createConversation(session, requestedId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "conflict", detail: msg }, 409);
  }
  return c.json({ conversation_id: record.conversation_id }, 201);
}

/**
 * GET /conversations/:conversation_id/connectors
 *
 * Returns `[{ descriptive_id, name, type, active }]` per spec. Captures
 * new-in-scope connectors as a side effect of the read.
 */
export async function listConversationConnectorsHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;
  const cid = c.req.param("conversation_id");
  if (!cid) return c.json({ error: "missing_conversation_id" }, 400);

  const record = getConversation(cid, session.session_id);
  if (!record) return c.json({ error: "conversation_not_found" }, 404);

  const items = listConnectorsForConversation(record, session);
  return c.json(items);
}

/**
 * PUT /conversations/:conversation_id/connectors/:descriptive_id
 *
 * Body: `{ active: boolean }`. Extra fields rejected (400). Returns 204
 * on success; 404 if cid unknown or did not in session scope.
 */
export async function setConversationConnectorStateHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;
  const cid = c.req.param("conversation_id");
  const did = c.req.param("descriptive_id");
  if (!cid || !did) return c.json({ error: "missing_path_param" }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return c.json({ error: "body_must_be_object" }, 400);
  }
  const fields = Object.keys(body as object);
  if (fields.length !== 1 || fields[0] !== "active") {
    return c.json({ error: "only_active_field_allowed" }, 400);
  }
  const active = (body as { active: unknown }).active;
  if (typeof active !== "boolean") {
    return c.json({ error: "active_must_be_boolean" }, 400);
  }

  const record = getConversation(cid, session.session_id);
  if (!record) return c.json({ error: "conversation_not_found" }, 404);

  const res = setConnectorActive(record, session, did, active);
  if (!res.ok) return c.json({ error: res.reason }, 404);

  return new Response(null, { status: 204 });
}

/**
 * PUT /conversations/:conversation_id/model
 *
 * Body: `{ model_id: string }`. Validates the id against the provider's
 * cached models list. 400 if unknown, 404 if cid unknown, 204 on success.
 */
export async function setConversationModelHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;
  const cid = c.req.param("conversation_id");
  if (!cid) return c.json({ error: "missing_conversation_id" }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return c.json({ error: "body_must_be_object" }, 400);
  }
  const fields = Object.keys(body as object);
  if (fields.length !== 1 || fields[0] !== "model_id") {
    return c.json({ error: "only_model_id_field_allowed" }, 400);
  }
  const model_id = (body as { model_id: unknown }).model_id;
  if (typeof model_id !== "string" || model_id.length === 0) {
    return c.json({ error: "model_id_must_be_non_empty_string" }, 400);
  }

  const record = getConversation(cid, session.session_id);
  if (!record) return c.json({ error: "conversation_not_found" }, 404);

  let known;
  try {
    const models = await ensureModelsCached(session);
    known = models.find((m) => m.id === model_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "provider_list_failed", detail: msg }, 502);
  }
  if (!known) return c.json({ error: "unknown_model_id" }, 400);

  setConversationModel(record, model_id);
  return new Response(null, { status: 204 });
}
