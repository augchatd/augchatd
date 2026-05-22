---
id: constraint-observability
type: constraint
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does NOT do (observability)"
---

# Constraint — Observability

## What augchatd ships

- **Logs to stderr.** The operator wires their own collector (Loki, CloudWatch, Datadog, etc.).
- Sanitized log lines — credentials and internal URLs do not appear.

## What augchatd does **not** ship

- Dashboards
- Metrics endpoints / Prometheus scrape targets
- Distributed tracing instrumentation
- Built-in audit log

These are deliberately out of scope. Integrators that need them wire their own collectors or run augchatd behind a proxy that emits them.

> [!NOTE] Assumption
> The README states "Logs go to stderr; wire your own collector" but does not specify a log format. Until code lands, the format is an evidence gap. Default expectation: structured (JSON) lines, but unconfirmed.
