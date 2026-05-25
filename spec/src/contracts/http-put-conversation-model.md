---
id: technical-contract-http-put-conversation-model
type: technical-contract
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (minimal browser API)"
links:
  - relation: supports
    target: cap-model-selection
  - relation: depends_on
    target: technical-contract-http-get-session-models
---

# Technical contract — `PUT /conversations/:conversation_id/model`

## Auth

JWT (Bearer), per [browser-streaming](browser-streaming.md).

## Request

`PUT /conversations/:conversation_id/model`
`Content-Type: application/json`

```json
{ "model_id": "gpt-4.1" }
```

`model_id` MUST be a non-empty string AND a member of the session's current `GET /session/models` list (validated against the same in-process cache; the cache is filled if cold).

## Response — success

`204 No Content`

The override is persisted to hot SQLite per `(tenant, user)` on the `conversation` row. Subsequent chat turns against this `conversation_id` use the new `model_id` (the chat handler resolves the override at the start of each turn). The override survives process restart.

## Response — failure modes

| Status | Body | When |
| --- | --- | --- |
| `400` | `{ "error": "invalid_json" }` | Body is not valid JSON. |
| `400` | `{ "error": "body_must_be_object" }` | Body is JSON but not a plain object. |
| `400` | `{ "error": "only_model_id_field_allowed" }` | Body contains fields other than `model_id` (the contract is single-field by design). |
| `400` | `{ "error": "model_id_must_be_non_empty_string" }` | `model_id` is empty, missing, or not a string. |
| `400` | `{ "error": "unknown_model_id" }` | `model_id` is not in the session's current `GET /session/models` list. |
| `401` | `{ "error": "..." }` | Missing / invalid / expired JWT (per [jwt-refresh](../behavior/contracts/jwt-refresh.md)). |
| `502` | `{ "error": "provider_list_failed", "detail": "..." }` | The provider's list-models call (needed to validate `model_id`) failed. |
| `503` | `{ "error": "hot_write_failed", "detail": "..." }` with header `X-Augchatd-Reason: hot-write-failed` | Hot SQLite write failed (see [contract-storage-hot](../behavior/contracts/storage-hot.md)). |

## Scope of the override

- **Only `model_id` is per-conversation.** `provider` and `api_key` remain session-scoped — the integrator chose them at session creation.
- Different conversations of the same session can pick different models. Each conversation's override is independent and stored on its `conversation` row.
- Conversations with no override fall back to the session's default (`model.model_id` from session creation).

## Related

- [http-get-session-models](http-get-session-models.md) — source of valid `model_id` values
- [contract-session-chat](../behavior/contracts/session-chat.md) — where the override is resolved per turn
- [contract-storage-hot](../behavior/contracts/storage-hot.md) — the hot-write that persists the override
- Capability: [cap-model-selection](../behavior/capabilities.md)
