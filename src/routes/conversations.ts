import type { Context } from "hono";
import type { SessionRecord } from "../session-registry.ts";
import {
  createConversation,
  getConversation,
  listConnectorsForConversation,
  listMessages,
  setConnectorActive,
  setConversationModel,
} from "../conversation-registry.ts";
import { HotWriteError } from "../storage.ts";
import { ensureModelsCached } from "./models.ts";

/**
 * Conversation + per-conversation toggle/model/messages endpoints.
 *
 * Backed by hot SQLite (see src/storage.ts, contract-storage-hot).
 * Write failures surface as `503 X-Augchatd-Reason: hot-write-failed`,
 * per spec.
 */

function hotWriteResponse(c: Context, err: HotWriteError): Response {
  c.header("X-Augchatd-Reason", "hot-write-failed");
  return c.json({ error: "hot_write_failed", detail: err.detail }, 503);
}

function tryHotWrite<T>(c: Context, fn: () => T): T | Response {
  try {
    return fn();
  } catch (err) {
    if (err instanceof HotWriteError) return hotWriteResponse(c, err);
    throw err;
  }
}

/**
 * POST /conversations
 *
 * Body (optional): `{ conversation_id?: string }`. If supplied, the
 * registry binds to that id; otherwise a UUID is minted. Idempotent on
 * `conversation_id`.
 *
 * Returns `201 { conversation_id }`.
 */
export async function createConversationHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;

  let requestedId: string | undefined;
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
      /* empty body w/ json content-type — treat as no requestedId */
    }
  }

  const result = tryHotWrite(c, () => createConversation(session, requestedId));
  if (result instanceof Response) return result;
  return c.json({ conversation_id: result.conversation_id }, 201);
}

/** GET /conversations/:conversation_id/connectors */
export async function listConversationConnectorsHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;
  const cid = c.req.param("conversation_id");
  if (!cid) return c.json({ error: "missing_conversation_id" }, 400);

  const recordOrRes = tryHotWrite(
    c,
    () => getConversation(cid, session) ?? createConversation(session, cid),
  );
  if (recordOrRes instanceof Response) return recordOrRes;

  const itemsOrRes = tryHotWrite(c, () =>
    listConnectorsForConversation(recordOrRes, session),
  );
  if (itemsOrRes instanceof Response) return itemsOrRes;
  return c.json(itemsOrRes);
}

/** PUT /conversations/:conversation_id/connectors/:descriptive_id */
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

  // PUT does NOT auto-create the conversation (per contract-connector-toggle
  // §Observable outcomes: "PUT /conversations/:unknown_cid/... returns 404").
  // Auto-create lives on POST /conversations and POST /chat; PUTs require an
  // already-known cid.
  const record = getConversation(cid, session);
  if (!record) return c.json({ error: "conversation_not_found" }, 404);

  const setOrRes = tryHotWrite(c, () =>
    setConnectorActive(record, session, did, active),
  );
  if (setOrRes instanceof Response) return setOrRes;
  if (!setOrRes.ok) return c.json({ error: setOrRes.reason }, 404);

  return new Response(null, { status: 204 });
}

/** PUT /conversations/:conversation_id/model */
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

  // Symmetric with the connector-toggle PUT: do not auto-create the
  // conversation on an unknown cid. Returns 404 instead.
  const record = getConversation(cid, session);
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

  const setOrRes = tryHotWrite(c, () =>
    setConversationModel(record, session, model_id),
  );
  if (setOrRes instanceof Response) return setOrRes;
  return new Response(null, { status: 204 });
}

/**
 * GET /conversations/:conversation_id/messages
 *
 * Returns the stored UI message history (assistant-ui-shaped parts).
 * 404 if cid unknown for this session's user. Persisted on each chat
 * turn (see chat.ts onFinish).
 *
 * The bundled UI does not consume this endpoint yet — assistant-ui's
 * runtime keeps thread state in-memory and a hard reload loses it.
 * Hydrating from this endpoint is a follow-up (separate ergonomic
 * work, no spec change needed).
 */
export async function listConversationMessagesHandler(c: Context): Promise<Response> {
  const session = c.get("session") as SessionRecord;
  const cid = c.req.param("conversation_id");
  if (!cid) return c.json({ error: "missing_conversation_id" }, 400);

  const record = getConversation(cid, session);
  if (!record) return c.json({ error: "conversation_not_found" }, 404);

  const items = listMessages(record, session);
  return c.json({ messages: items });
}
