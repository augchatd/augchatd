---
id: constraint-observability
type: constraint
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does NOT do (observability)"
---

# Constraint — Observability

> [!IMPORTANT] PENDING RECONCILIATION
> **Code added an opt-in JSONL conversation trace that this constraint does not yet cover.**
>
> `src/trace.ts` + chat-handler wiring (on branch `trace-conversations`) accept
> `AUGCHATD_TRACE_DIR=/path/to/dir`. When set, each POST `/chat` appends a
> per-conversation JSONL file (`${conversation_id}.jsonl`) with one event per
> line: `request`, `step.finish`, `response.finish`, `error`. Unset = off (no
> filesystem cost). The mechanism is local-only (writes to a directory the
> operator points at); augchatd does not ship to OTel, Loki, or any standard
> collector. Credentials (`api_key`) are never written.
>
> This sits adjacent to two things this constraint *explicitly* excludes:
> "distributed tracing instrumentation" and "built-in audit log." Neither
> label fits cleanly — it is not OTel, and it is not a tamper-evident audit
> trail. It is a **debug-time conversation dump for the operator**.
>
> **Proposed direction (preferred):** add a third bullet to "What augchatd
> ships":
>
>   - **Optional per-conversation JSONL trace.** Enabled by
>     `AUGCHATD_TRACE_DIR`. One file per conversation, append-only, line per
>     event. Off by default. Mode-agnostic. Credentials redacted.
>
> Rationale: the early-iteration value of being able to replay what the LLM +
> tools actually did, per conversation, is high; the cost (a single env var
> and one file handle per chat request) is negligible; and keeping it opt-in
> preserves the "wire your own collector" stance for everything else.
>
> **Alternatives considered (worth a human decision):**
> 1. Reword the existing "Built-in audit log" exclusion to admit the trace
>    *is* a debug log (not an audit log — non-tamper-evident) so the
>    exclusions list stays intact.
> 2. Move tracing out to a separate `constraint-tracing.md` (overkill for
>    one env var).
>
> No silent edit applied — leaving the canonical text below until decided.

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
