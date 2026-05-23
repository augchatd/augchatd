import type { Connector } from "./connectors.ts";
import type { SessionRecord } from "./session-registry.ts";

/**
 * Per-conversation connector active state.
 *
 * Implements the contract surface of [contract-connector-toggle] and the
 * two technical contracts (GET /conversations/:cid/connectors,
 * PUT /conversations/:cid/connectors/:did) — see spec/.
 *
 * PERSISTENCE — divergence from spec
 * ----------------------------------
 * The spec requires the saved active state to live in hot SQLite +
 * cold S3 so it survives session re-mint. Storage layer is not yet
 * implemented. This registry is **in-memory**: dies on process restart.
 * The HTTP contract surface is otherwise identical, so swapping the
 * backing store is a localized change.
 *
 * CAPTURE-ON-FIRST-OBSERVATION
 * ----------------------------
 * Per the spec, a conversation's saved flag for a connector is
 * snapshotted from `default_active` the FIRST time the connector is
 * observed in the conversation's purview (creation or first
 * GET/chat). After capture, only an explicit PUT mutates it. New
 * connectors added to the session after creation are captured on
 * their first GET; removed connectors keep their saved row but are
 * filtered out of GET responses.
 */

export interface ConversationRecord {
  conversation_id: string;
  session_id: string;
  /** descriptive_id → saved active flag. */
  active_map: Map<string, boolean>;
}

const registry = new Map<string, ConversationRecord>();

/**
 * Create a new conversation record bound to `session`. If `requestedId`
 * is provided (e.g. the assistant-ui thread id from the client), use it;
 * otherwise mint a UUID. Snapshots `default_active` for every connector
 * currently in scope.
 *
 * Idempotent on requestedId: a second call for an existing id returns
 * the existing record (no re-snapshot, so subsequent toggles are
 * preserved). Callers that need "create fresh" should pass a new id.
 */
export function createConversation(
  session: SessionRecord,
  requestedId: string | undefined,
): ConversationRecord {
  const conversation_id = requestedId ?? crypto.randomUUID();
  const existing = registry.get(conversation_id);
  if (existing) {
    if (existing.session_id !== session.session_id) {
      throw new Error(
        `conversation ${conversation_id} belongs to a different session`,
      );
    }
    return existing;
  }
  const active_map = new Map<string, boolean>();
  for (const c of session.connectors) {
    active_map.set(c.descriptive_id, c.default_active);
  }
  const record: ConversationRecord = {
    conversation_id,
    session_id: session.session_id,
    active_map,
  };
  registry.set(conversation_id, record);
  return record;
}

export function getConversation(
  conversation_id: string,
  session_id: string,
): ConversationRecord | undefined {
  const r = registry.get(conversation_id);
  if (!r) return undefined;
  if (r.session_id !== session_id) return undefined; // tenant scoping
  return r;
}

/**
 * Per the spec: capture-on-first-observation. If the connector is in the
 * session's scope but not yet in the saved active_map, snapshot
 * `default_active` now. Mutates the record in place.
 */
function captureNewlyInScope(
  record: ConversationRecord,
  session: SessionRecord,
): void {
  for (const c of session.connectors) {
    if (!record.active_map.has(c.descriptive_id)) {
      record.active_map.set(c.descriptive_id, c.default_active);
    }
  }
}

export interface ConnectorListItem {
  descriptive_id: string;
  name: string;
  type: "mcp" | "rag";
  active: boolean;
}

/**
 * List connectors visible to this conversation, with their saved active
 * state. Captures new-in-scope connectors as a side effect. Excludes
 * connectors no longer in the session's resolved scope.
 *
 * Order follows the session's connectors[] payload.
 */
export function listConnectorsForConversation(
  record: ConversationRecord,
  session: SessionRecord,
): ConnectorListItem[] {
  captureNewlyInScope(record, session);
  return session.connectors.map((c: Connector) => ({
    descriptive_id: c.descriptive_id,
    name: c.name,
    type: c.type,
    active: record.active_map.get(c.descriptive_id) ?? c.default_active,
  }));
}

export type SetActiveResult =
  | { ok: true }
  | { ok: false; reason: "connector_not_in_scope" };

export function setConnectorActive(
  record: ConversationRecord,
  session: SessionRecord,
  descriptive_id: string,
  active: boolean,
): SetActiveResult {
  const c = session.connectors.find((x) => x.descriptive_id === descriptive_id);
  if (!c) return { ok: false, reason: "connector_not_in_scope" };
  record.active_map.set(descriptive_id, active);
  return { ok: true };
}

/**
 * Snapshot of active flags for a chat turn. Captures any new-in-scope
 * connectors first (per spec: "captured at the start of each chat
 * turn"). Returns descriptive_id → active.
 */
export function snapshotActiveMap(
  record: ConversationRecord,
  session: SessionRecord,
): Map<string, boolean> {
  captureNewlyInScope(record, session);
  const out = new Map<string, boolean>();
  for (const c of session.connectors) {
    out.set(c.descriptive_id, record.active_map.get(c.descriptive_id) ?? c.default_active);
  }
  return out;
}
