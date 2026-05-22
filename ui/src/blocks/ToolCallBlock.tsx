/**
 * Renders a tool-call part (the LLM's tool invocation) as an inline,
 * collapsible block within the assistant message. Plugged into
 * MessagePrimitive.Parts via `tools: { Fallback: ToolCallBlock }`.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 🔧  echo            (mcp_mock)            Done          │
 *   │     ▸ Arguments     { "text": "hi" }                    │
 *   │     ▸ Result        "hi"                                │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Tool names in augchatd are namespaced `<descriptive_id>__<tool>` to
 * avoid collisions across MCP connectors; we split for display.
 */

interface ToolCallBlockProps {
  toolCallId: string;
  toolName: string;
  args: unknown;
  argsText: string;
  result?: unknown;
  isError?: boolean;
}

export function ToolCallBlock(props: ToolCallBlockProps) {
  const { connector, tool } = splitToolName(props.toolName);
  const hasResult = props.result !== undefined;
  const status: "running" | "error" | "done" = props.isError
    ? "error"
    : hasResult
      ? "done"
      : "running";

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-bg-base">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span aria-hidden>🔧</span>
          <span className="font-mono font-semibold">{tool}</span>
          {connector && (
            <span className="rounded bg-bg-mid px-1.5 py-0.5 text-fg-muted">
              {connector}
            </span>
          )}
        </div>
        <StatusBadge status={status} />
      </div>
      <details className="border-b border-border last:border-b-0">
        <summary className="cursor-pointer px-3 py-1.5 text-xs text-fg-muted hover:text-fg-base">
          Arguments
        </summary>
        <pre className="overflow-x-auto px-3 pb-2 font-mono text-[0.85em] text-fg-base">
          {formatJson(props.args ?? safeJsonParse(props.argsText))}
        </pre>
      </details>
      {hasResult && (
        <details open className="last:border-b-0">
          <summary className="cursor-pointer px-3 py-1.5 text-xs text-fg-muted hover:text-fg-base">
            Result
          </summary>
          <pre className="overflow-x-auto px-3 pb-2 font-mono text-[0.85em] text-fg-base">
            {formatResult(props.result)}
          </pre>
        </details>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "running" | "error" | "done" }) {
  const map = {
    running: { label: "Running…", cls: "text-fg-muted" },
    error: { label: "Error", cls: "text-warn-fg" },
    done: { label: "Done", cls: "text-fg-base" },
  } as const;
  return (
    <span className={`font-mono uppercase tracking-wider ${map[status].cls}`}>
      {map[status].label}
    </span>
  );
}

function splitToolName(name: string): { connector: string | null; tool: string } {
  const sep = name.indexOf("__");
  if (sep === -1) return { connector: null, tool: name };
  return { connector: name.slice(0, sep), tool: name.slice(sep + 2) };
}

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function safeJsonParse(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "—";
  return formatJson(value);
}
