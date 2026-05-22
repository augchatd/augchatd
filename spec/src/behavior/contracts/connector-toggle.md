---
id: contract-connector-toggle
type: behavior-contract
status: proposed
capability: cap-connectors
evidence:
  - source: README.md
    section: "Connectors (browser toggle)"
links:
  - relation: depends_on
    target: contract-session-create
  - relation: depends_on
    target: technical-contract-http-get-connectors
  - relation: depends_on
    target: technical-contract-http-put-connector-state
  - relation: refines
    target: contract-session-chat
  - relation: refines
    target: adr-0010-unified-connector-model
---

# Contract — Connector toggle

## Promise

For a live session, the browser can:

1. **List** the session's connectors with their current active state via `GET /connectors`.
2. **Toggle** an individual connector's active state via `PUT /connectors/:descriptive_id { active: bool }`.

The listing response carries only `descriptive_id`, `name`, `type`, and `active` — no credentials, no URLs, no auth payload.

Subsequent chat turns observe the updated active set. The active set is **captured at the start of each chat turn** ([contract-session-chat](session-chat.md)); toggling that races with an in-flight turn does **not** abort tool calls already running.

The end user can only **narrow** the resolved scope by turning connectors off. They cannot add a connector — the session's connector list is fixed at session creation by the integrator (see [adr-0010](../../architecture/adrs/0010-unified-connector-model.md)).

## Observable outcomes

- `GET /connectors` returns the list with current `active` flags; the response is free of credentials, URLs, and auth.
- `PUT /connectors/:descriptive_id` with `{ active: false }` flips the connector off; the next `POST /chat` turn does not expose its tools.
- `PUT /connectors/:descriptive_id` with `{ active: true }` for a connector that was off flips it on; the next chat turn exposes its tools.
- `PUT /connectors/:unknown_id` returns 404; no other connector is affected.
- After a forced re-mint (`DELETE /sessions/:id` followed by `POST /sessions`), the new session's connector states are again whatever the new payload declared (the previous active states do not persist into a new `session_id`).

## Non-promises

- Toggling does not abort in-flight tool calls already issued in the current turn.
- Toggling does not modify the connector's configuration (credentials, URL, indexes). Only the `active` flag changes.
- The end user cannot **add** a connector via toggling. The connector list is fixed at session creation; only state changes.
- augchatd does not persist per-user "preferred" active states across sessions. **Every new session_id starts with active states equal to each connector's `default_active`**, regardless of how the previous session ended (JWT expiry, idle disconnect, forced delete, browser refresh). If preserving end-user preferences across re-mints matters, the bundled UI is the place to cache them client-side and re-apply via `PUT /connectors/:descriptive_id` after each session start.

## Tests this contract implies

- `GET /connectors` before any toggle: returns each connector with `active = default_active`.
- `PUT /connectors/X { active: false }` followed by `POST /chat`: X's tool not invoked.
- `PUT /connectors/X { active: true }` for a previously-off X followed by `POST /chat`: X's tool exposed and invocable.
- `PUT /connectors/unknown` → 404.
- Listing response contains no field whose name appears in the session payload's connector secrets (e.g. `auth`, `api_key`, `cluster`).
