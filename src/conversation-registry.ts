import type { Connector } from "./connectors.ts";
import type { SessionRecord } from "./session-registry.ts";
import { HotWriteError, storageFor } from "./storage.ts";

/**
 * Per-conversation connector active state, model override, and message
 * history — persisted in the hot SQLite DB per (tenant, user). Backs
 * the contract surfaces of contract-connector-toggle, the model picker
 * (cap-session-mgmt + the picker PENDING), and the messages history
 * for replay/audit.
 *
 * What this module owns
 *   - createConversation       — first-observation snapshot of default_active
 *                                for every in-scope connector
 *   - getConversation          — lookup-by-id within a session's tenant/user
 *   - listConnectorsForConversation — `GET /conversations/:cid/connectors`
 *   - setConnectorActive       — `PUT /conversations/:cid/connectors/:did`
 *   - snapshotActiveMap        — chat handler reads this at turn start
 *   - setConversationModel     — `PUT /conversations/:cid/model`
 *   - resolveModelId           — chat handler reads this at turn start
 *   - upsertMessage / listMessages — message history
 *
 * The "record" handed back is intentionally lightweight (just an id).
 * State lives in the DB; methods re-query as needed. There is no cache
 * (contract-storage-hot: "canonical row, no per-session cache").
 *
 * Write failures throw HotWriteError; the route layer maps them to
 * `503 X-Augchatd-Reason: hot-write-failed`.
 */

export interface ConversationRecord {
  conversation_id: string;
}

export interface ConnectorListItem {
  descriptive_id: string;
  name: string;
  type: "mcp" | "rag";
  active: boolean;
}

export type SetActiveResult =
  | { ok: true }
  | { ok: false; reason: "connector_not_in_scope" };

export interface StoredMessage {
  message_id: string;
  ordinal: number;
  role: string;
  parts: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

function snapshotDefaultsTx(
  db: ReturnType<typeof storageFor>,
  cid: string,
  session: SessionRecord,
): void {
  const now = nowIso();
  // Insert only for connectors not yet captured (idempotent on cid+did).
  const exists = db.prepare(
    "SELECT 1 FROM connector_state WHERE conversation_id = ? AND descriptive_id = ?",
  );
  const insert = db.prepare(
    "INSERT INTO connector_state (conversation_id, descriptive_id, active, updated_at) VALUES (?, ?, ?, ?)",
  );
  for (const c of session.connectors) {
    if (exists.get(cid, c.descriptive_id)) continue;
    insert.run(cid, c.descriptive_id, c.default_active ? 1 : 0, now);
  }
}

export function createConversation(
  session: SessionRecord,
  requestedId: string | undefined,
): ConversationRecord {
  const cid = requestedId ?? crypto.randomUUID();
  const db = storageFor(session);
  const now = nowIso();
  try {
    db.transaction(() => {
      const existing = db
        .prepare("SELECT 1 FROM conversation WHERE conversation_id = ?")
        .get(cid);
      if (!existing) {
        db.prepare(
          "INSERT INTO conversation (conversation_id, session_id, created_at) VALUES (?, ?, ?)",
        ).run(cid, session.session_id, now);
      }
      // Capture-on-first-observation, idempotent for already-captured rows.
      snapshotDefaultsTx(db, cid, session);
    })();
  } catch (err) {
    if (err instanceof HotWriteError) throw err;
    throw new HotWriteError(err instanceof Error ? err.message : String(err));
  }
  return { conversation_id: cid };
}

export function getConversation(
  conversation_id: string,
  session: SessionRecord,
): ConversationRecord | undefined {
  const db = storageFor(session);
  const row = db
    .prepare("SELECT conversation_id FROM conversation WHERE conversation_id = ?")
    .get(conversation_id) as { conversation_id: string } | undefined;
  if (!row) return undefined;
  return { conversation_id: row.conversation_id };
}

export function listConnectorsForConversation(
  record: ConversationRecord,
  session: SessionRecord,
): ConnectorListItem[] {
  // Capture any new-in-scope connectors first (sliding scope).
  try {
    snapshotDefaultsTx(storageFor(session), record.conversation_id, session);
  } catch (err) {
    throw new HotWriteError(err instanceof Error ? err.message : String(err));
  }
  const map = readActiveMap(record.conversation_id, session);
  return session.connectors.map((c: Connector) => ({
    descriptive_id: c.descriptive_id,
    name: c.name,
    type: c.type,
    active: map.get(c.descriptive_id) ?? c.default_active,
  }));
}

export function setConnectorActive(
  record: ConversationRecord,
  session: SessionRecord,
  descriptive_id: string,
  active: boolean,
): SetActiveResult {
  const c = session.connectors.find((x) => x.descriptive_id === descriptive_id);
  if (!c) return { ok: false, reason: "connector_not_in_scope" };
  const db = storageFor(session);
  try {
    db.prepare(
      `INSERT INTO connector_state (conversation_id, descriptive_id, active, updated_at)
         VALUES (?, ?, ?, ?)
       ON CONFLICT(conversation_id, descriptive_id) DO UPDATE SET
         active     = excluded.active,
         updated_at = excluded.updated_at`,
    ).run(record.conversation_id, descriptive_id, active ? 1 : 0, nowIso());
  } catch (err) {
    throw new HotWriteError(err instanceof Error ? err.message : String(err));
  }
  return { ok: true };
}

function readActiveMap(
  conversation_id: string,
  session: SessionRecord,
): Map<string, boolean> {
  const db = storageFor(session);
  const rows = db
    .prepare(
      "SELECT descriptive_id, active FROM connector_state WHERE conversation_id = ?",
    )
    .all(conversation_id) as Array<{ descriptive_id: string; active: number }>;
  const out = new Map<string, boolean>();
  for (const r of rows) out.set(r.descriptive_id, r.active === 1);
  return out;
}

export function snapshotActiveMap(
  record: ConversationRecord,
  session: SessionRecord,
): Map<string, boolean> {
  // Capture-on-first-observation for any newly-in-scope connectors so
  // chat-turn sees them with their default_active.
  try {
    snapshotDefaultsTx(storageFor(session), record.conversation_id, session);
  } catch (err) {
    throw new HotWriteError(err instanceof Error ? err.message : String(err));
  }
  const saved = readActiveMap(record.conversation_id, session);
  const out = new Map<string, boolean>();
  for (const c of session.connectors) {
    out.set(c.descriptive_id, saved.get(c.descriptive_id) ?? c.default_active);
  }
  return out;
}

export function setConversationModel(
  record: ConversationRecord,
  session: SessionRecord,
  model_id: string,
): void {
  const db = storageFor(session);
  try {
    db.prepare(
      "UPDATE conversation SET model_id_override = ? WHERE conversation_id = ?",
    ).run(model_id, record.conversation_id);
  } catch (err) {
    throw new HotWriteError(err instanceof Error ? err.message : String(err));
  }
}

export function resolveModelId(
  record: ConversationRecord,
  session: SessionRecord,
): string {
  const db = storageFor(session);
  const row = db
    .prepare(
      "SELECT model_id_override FROM conversation WHERE conversation_id = ?",
    )
    .get(record.conversation_id) as
    | { model_id_override: string | null }
    | undefined;
  return row?.model_id_override ?? session.model.model_id;
}

/**
 * Upsert all messages of a thread (idempotent by message_id). Called at
 * the end of each chat turn from chat.ts's createUIMessageStream
 * onFinish — the messages array is the FULL updated thread.
 */
export function upsertMessages(
  record: ConversationRecord,
  session: SessionRecord,
  messages: Array<{ id: string; role: string; parts: unknown }>,
): void {
  const db = storageFor(session);
  const now = nowIso();
  try {
    db.transaction(() => {
      const stmt = db.prepare(
        `INSERT INTO message (conversation_id, message_id, ordinal, role, parts_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(conversation_id, message_id) DO UPDATE SET
           ordinal    = excluded.ordinal,
           role       = excluded.role,
           parts_json = excluded.parts_json,
           updated_at = excluded.updated_at`,
      );
      messages.forEach((m, i) => {
        stmt.run(
          record.conversation_id,
          m.id,
          i,
          m.role,
          JSON.stringify(m.parts ?? []),
          now,
        );
      });
    })();
  } catch (err) {
    throw new HotWriteError(err instanceof Error ? err.message : String(err));
  }
}

export function listMessages(
  record: ConversationRecord,
  session: SessionRecord,
): StoredMessage[] {
  const db = storageFor(session);
  const rows = db
    .prepare(
      `SELECT message_id, ordinal, role, parts_json
         FROM message
        WHERE conversation_id = ?
        ORDER BY ordinal ASC, message_id ASC`,
    )
    .all(record.conversation_id) as Array<{
    message_id: string;
    ordinal: number;
    role: string;
    parts_json: string;
  }>;
  return rows.map((r) => ({
    message_id: r.message_id,
    ordinal: r.ordinal,
    role: r.role,
    parts: safeJsonParse(r.parts_json),
  }));
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
