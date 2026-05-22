---
id: story-0009-operator-catches-bad-deploy
type: user-story
status: proposed
derived_from:
  - technical-contract-http-get-healthz
  - contract-demo-mode
audience: "Integrator operator / SRE"
---

# 0009 — Operator's deploy gate catches an accidental demo-mode push to production

**As** the operator running augchatd in production,
**I want** my deploy pipeline to fail when a candidate build is configured to boot in demo mode,
**So that** a forgotten `AUGCHATD_MODE=demo` env var does not put a single-tenant, mTLS-bypassed daemon in front of real users.

## Scenario — production deploy with stale env

```
Given a candidate release is rolled out to a production node
  And the deployment manifest accidentally still carries AUGCHATD_MODE=demo (left over from a smoke test)
 When the deploy pipeline probes GET /healthz on the candidate
 Then the response is { "mode": "demo", "status": "ok" }
  And the deploy gate fails on `mode != "prod"` and rolls back
  And no production traffic reaches the demo-configured process
```

## Scenario — clean production deploy

```
Given a candidate release is rolled out with no AUGCHATD_MODE override
 When the deploy pipeline probes GET /healthz
 Then the response is { "mode": "prod", "status": "ok" }
  And the deploy gate passes and traffic is shifted
```

## Scenario — local developer hits healthz

```
Given a developer runs the demo container locally
 When they curl http://localhost:8080/healthz
 Then they receive { "mode": "demo", "status": "ok" }
  And they recognize the local instance as a demo, distinct from any prod URL they may have open
```

## Why this matters

Demo mode bypasses mTLS and runs single-tenant; reaching production with that configuration is the most damaging operational mistake the daemon enables. `GET /healthz` is the only contract augchatd offers that *cannot* be wrong about the running mode — every prod deployment pipeline should treat the `mode` field as a hard gate.
