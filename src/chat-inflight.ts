/**
 * Per-conversation chat in-flight registry.
 *
 * Records the set of conversation_ids that currently have an active
 * `POST /chat` streaming response. The chat handler brackets each turn
 * with markChatStart / markChatEnd; PUT handlers consult isChatInFlight
 * to know whether their write coincided with an in-flight turn (in which
 * case the active-map snapshot at turn start has already locked in the
 * old value and the new write only takes effect on the next turn —
 * contract-session-chat §"Toggle audit").
 *
 * Refcount, not a flag: two concurrent chat turns on the same cid are
 * unusual (the bundled UI does not issue them) but legal — the PUT
 * deferred-toggle audit must remain true while any of them is in flight.
 *
 * State is process-local. Crash or restart resets it — acceptable, the
 * audit is operator-grade not durability-grade.
 */
const inflight = new Map<string, number>();

export function markChatStart(conversationId: string): void {
  inflight.set(conversationId, (inflight.get(conversationId) ?? 0) + 1);
}

export function markChatEnd(conversationId: string): void {
  const n = (inflight.get(conversationId) ?? 0) - 1;
  if (n <= 0) inflight.delete(conversationId);
  else inflight.set(conversationId, n);
}

export function isChatInFlight(conversationId: string): boolean {
  return (inflight.get(conversationId) ?? 0) > 0;
}
