import { useEffect, useId, useRef, useState } from "react";

/**
 * Renders ```mermaid fenced code blocks as actual diagrams.
 *
 * mermaid is lazy-imported (~250 KB gz) — the library only loads after
 * the first mermaid fence appears in a conversation. Subsequent diagrams
 * reuse the cached module.
 */
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

export function MermaidBlock({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "_");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadMermaid()
      .then((mermaid) => mermaid.render(`m_${id}`, chart))
      .then(({ svg }) => {
        if (cancelled) return;
        setSvg(svg);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="my-3 rounded-lg border border-warn-border bg-warn-bg p-3 text-warn-fg">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider">
          Mermaid render error
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs">{error}</pre>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-fg-muted">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 rounded-lg border border-border bg-bg-soft p-3 text-fg-muted">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 flex justify-center overflow-x-auto rounded-lg border border-border bg-bg-soft p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
