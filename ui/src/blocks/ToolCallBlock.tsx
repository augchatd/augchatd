import { Children, type PropsWithChildren } from "react";

/**
 * Tool-call rendering, two-tier collapse:
 *
 * 1. `ToolGroup` wraps N consecutive tool calls.
 *    - N === 1 → transparent passthrough (no group UI; the single pill
 *      stands on its own).
 *    - N >= 2 → `<details>` collapsible: summary "🔧 3 tool calls" plus
 *      the rolled-up status of the group; expanded shows each child
 *      pill stacked.
 *
 * 2. `ToolCallBlock` is the per-call pill.
 *    Default state: a single line — `🔧 <tool> (<connector>) · Done`.
 *    Click expands: arguments + result.
 *
 * Two clicks to drill from a many-call message into the JSON of one
 * specific call. Quiet by default; full detail on demand.
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
  const status: Status = props.isError ? "error" : hasResult ? "done" : "running";

  return (
    <details className="my-1 rounded border border-border bg-bg-base [&[open]>summary]:border-b [&[open]>summary]:border-border">
      <summary className="flex cursor-pointer items-center justify-between px-2.5 py-1 text-[12px] font-mono hover:bg-bg-soft">
        <span className="flex items-center gap-1.5">
          <span aria-hidden>🔧</span>
          <span>{tool}</span>
          {connector && <span className="text-fg-muted">({connector})</span>}
        </span>
        <StatusDot status={status} />
      </summary>
      <div className="px-2.5 py-2 text-[12px]">
        <div className="mb-0.5 font-mono uppercase tracking-wider text-[10px] text-fg-muted">
          Arguments
        </div>
        <pre className="mb-2 overflow-x-auto font-mono text-[11px] text-fg-base">
          {formatJson(props.args ?? safeJsonParse(props.argsText))}
        </pre>
        {hasResult && (
          <>
            <div className="mb-0.5 font-mono uppercase tracking-wider text-[10px] text-fg-muted">
              Result
            </div>
            <pre className="overflow-x-auto font-mono text-[11px] text-fg-base">
              {formatResult(props.result)}
            </pre>
          </>
        )}
      </div>
    </details>
  );
}

/**
 * Wraps consecutive tool calls.
 *
 * For a single call, renders the child pill directly so the user sees
 * just `🔧 toolName · Done` inline. For 2+ calls, wraps in one
 * collapsible: `🔧 N tool calls` with the children stacked inside.
 */
export function ToolGroup({
  children,
}: PropsWithChildren<{ startIndex: number; endIndex: number }>) {
  const count = Children.count(children);
  if (count <= 1) return <>{children}</>;
  return (
    <details className="my-2 rounded border border-border bg-bg-soft">
      <summary className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-[12px] hover:bg-bg-mid">
        <span className="flex items-center gap-1.5 font-mono">
          <span aria-hidden>🔧</span>
          <span>{count} tool calls</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          tap to expand
        </span>
      </summary>
      <div className="space-y-1 border-t border-border px-2.5 py-2">
        {children}
      </div>
    </details>
  );
}

type Status = "running" | "error" | "done";

function StatusDot({ status }: { status: Status }) {
  const cls = {
    running: "bg-fg-muted animate-pulse",
    error: "bg-warn-fg",
    done: "bg-accent",
  }[status];
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-muted">
      {status === "done" ? "Done" : status === "error" ? "Error" : "Running"}
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
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
