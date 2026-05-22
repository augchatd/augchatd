import { useThread } from "@assistant-ui/react";

type SourcePart =
  | { type: "source-url"; url: string; title?: string }
  | { type: "source-document"; title: string; mediaType?: string };

interface SourceEntry {
  type: "url" | "document";
  label: string;
  href: string | undefined;
}

/**
 * Sources / citations panel.
 *
 * Walks the current thread's messages, collects `source-url` and
 * `source-document` UI parts (per the AI SDK v6 stream protocol), and
 * lists them in a small panel at the bottom of the thread.
 *
 * Will be empty until RAG-type connectors land and the chat handler
 * starts emitting `source` parts. Wired now so the slot exists.
 */
export function CitationsPanel() {
  const sources = useThread((t) =>
    collectSources(t.messages),
  );

  if (sources.length === 0) return null;

  return (
    <div className="mx-auto mt-4 w-full max-w-thread px-4">
      <details className="rounded-lg border border-border bg-bg-soft p-3 text-sm" open>
        <summary className="cursor-pointer font-semibold text-fg-base">
          Sources ({sources.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {sources.map((s, i) => (
            <li key={i} className="text-fg-muted">
              {s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function collectSources(messages: readonly { content?: unknown }[]): SourceEntry[] {
  const out: SourceEntry[] = [];
  for (const msg of messages) {
    const parts = (msg as { content?: unknown[] }).content;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const p = part as SourcePart;
      if (p?.type === "source-url") {
        out.push({ type: "url", label: p.title || p.url, href: p.url });
      } else if (p?.type === "source-document") {
        out.push({ type: "document", label: p.title, href: undefined });
      }
    }
  }
  return out;
}
