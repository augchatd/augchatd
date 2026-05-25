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
- **Optional per-conversation JSONL trace.** Enabled by setting `AUGCHATD_TRACE_DIR=/path/to/dir`. When set, each `POST /chat` appends a per-conversation JSONL file (`${conversation_id}.jsonl`) with one event per line: `request`, `step.finish`, `response.finish`, `error`. Off by default; zero filesystem cost when unset. Mode-agnostic. Credentials (`api_key`) are never written. This is a **debug-time conversation dump for the operator** — local files, not OTel, not a tamper-evident audit log; replay-grade rather than compliance-grade.

## What augchatd does **not** ship

- Dashboards
- Metrics endpoints / Prometheus scrape targets
- Distributed tracing instrumentation
- Built-in audit log

These are deliberately out of scope. Integrators that need them wire their own collectors or run augchatd behind a proxy that emits them.

> [!NOTE] Assumption
> The README states "Logs go to stderr; wire your own collector" but does not specify a log format. Until code lands, the format is an evidence gap. Default expectation: structured (JSON) lines, but unconfirmed.
