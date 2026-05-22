---
id: flow-session-setup
type: behavior-contract
status: proposed
capability: cap-session-mgmt
evidence:
  - source: README.md@e562b2b
    section: "README header (curl example) / How it works (steps 1–2)"
links:
  - relation: refines
    target: contract-session-create
  - relation: refines
    target: contract-ui-handshake
---

# Flow — Session setup

End-to-end view: the integrator goes from "user opens chat" to "iframe is alive with a JWT".

```
Browser (integrator page)         Integrator backend                augchatd
        │                                 │                              │
        │  open chat page                 │                              │
        │ ───────────────────────────►    │                              │
        │                                 │                              │
        │                                 │  POST /sessions (mTLS)       │
        │                                 │  { user_id, system_prompt,   │
        │                                 │    model+key, connectors[]?, │
        │                                 │    storage.s3 }              │
        │                                 │ ────────────────────────►    │
        │                                 │                              │  (1) validate
        │                                 │                              │  (2) write-test S3
        │                                 │                              │  (3) store in mem
        │                                 │                              │  (4) mint JWT
        │                                 │  { session_id, jwt,          │
        │                                 │    expires_at }              │
        │                                 │ ◄────────────────────────    │
        │                                 │                              │
        │  load <iframe src=augchatd>     │                              │
        │ ────────────────────────────────┼───────────────────────────►  │
        │                                 │                              │  serves bundled UI
        │  iframe → augchatd:ready        │                              │
        │ ◄───────────────────────────────┼──────                        │
        │                                 │                              │
        │  parent → augchatd:jwt          │                              │
        │ ──────────►                     │                              │
        │                                 │                              │
        │  iframe stores JWT,             │                              │
        │  ready to chat                  │                              │
```

## Notes

- The integrator backend never talks to the iframe; the iframe never talks back to the integrator backend except (via the parent page) to ask for a new JWT on 401.
- The bundled UI is served from the same origin as the JSON API; the JWT is used for both ends of that origin.
- `connectors[]` is optional. Minimal session is `model + storage`.
