import { appendFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Per-conversation JSONL tracer.
 *
 * Opt-in via AUGCHATD_TRACE_DIR. When unset, every function here is a
 * no-op and the writeTraceEvent path has zero filesystem cost.
 *
 * Wire intent:
 *   - One file per conversation: `${trace_dir}/${conversation_id}.jsonl`.
 *   - Append-only. Each line is one self-contained JSON event with at
 *     minimum: `ts` (ISO), `type` (e.g. "request", "step.finish",
 *     "response.finish", "error"), `conversation_id`, `session_id`.
 *   - Filtering is the operator's job — `jq 'select(.type=="step.finish")'`.
 *
 * Synchronous writes by design: each event is a tiny line, and sync
 * appends keep ordering deterministic without buffering work that a
 * process crash would silently lose.
 */

let traceDir: string | undefined;

export function initTrace(dir: string | undefined): void {
  traceDir = dir;
}

export function isTraceEnabled(): boolean {
  return traceDir !== undefined;
}

export function writeTraceEvent(
  conversationId: string,
  event: Record<string, unknown>,
): void {
  if (!traceDir) return;
  const safeId = sanitizeId(conversationId);
  const path = join(traceDir, `${safeId}.jsonl`);
  const enriched = { ts: new Date().toISOString(), ...event };
  try {
    appendFileSync(path, JSON.stringify(enriched) + "\n", "utf-8");
  } catch (err) {
    // Tracing must never break the chat path. Surface to stderr and
    // keep going.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`trace: failed to write ${path}: ${msg}`);
  }
}

// File-name safety: keep ascii letters/digits/.-_; collapse the rest to
// underscore; cap length so a hostile id can't blow up the FS.
function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return cleaned.length > 0 ? cleaned : "unknown";
}
