import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Per-conversation connector toggle popover (composer-toolbar variant).
 *
 * Backed by the GET/PUT endpoints from contract-connector-toggle:
 *   GET /conversations/:cid/connectors          → list with active flags
 *   PUT /conversations/:cid/connectors/:did     → toggle one
 *
 * Uses the shared authed-fetch (JWT refresh) provided by ChatRoom.
 */

interface ConnectorListItem {
  descriptive_id: string;
  name: string;
  type: "mcp" | "rag";
  active: boolean;
}

type AuthedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function ConnectorsMenu({
  conversationId,
  authedFetch,
}: {
  conversationId: string;
  authedFetch: AuthedFetch;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConnectorListItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await authedFetch(
        `/conversations/${encodeURIComponent(conversationId)}/connectors`,
      );
      if (!r.ok) throw new Error(`GET HTTP ${r.status}`);
      setItems((await r.json()) as ConnectorListItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [conversationId, authedFetch]);

  // Eagerly fetch on mount so the button label can show N/M without a click.
  useEffect(() => {
    void load();
  }, [load]);

  // Click outside closes the popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = async (descriptive_id: string, next: boolean) => {
    setBusy(descriptive_id);
    setError(null);
    try {
      const r = await authedFetch(
        `/conversations/${encodeURIComponent(conversationId)}/connectors/${encodeURIComponent(descriptive_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: next }),
        },
      );
      if (r.status !== 204) throw new Error(`PUT HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const activeCount = items?.filter((i) => i.active).length ?? 0;
  const totalCount = items?.length ?? 0;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          inline-flex items-center gap-1 rounded-md border border-border
          bg-bg-soft px-2.5 py-1 text-[12px] text-fg-base
          hover:bg-bg-mid
        "
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span aria-hidden>🛠</span>
        <span>Tools{items ? ` ${activeCount}/${totalCount}` : ""}</span>
      </button>
      {open && (
        <div
          className="
            absolute bottom-full left-0 z-10 mb-1 w-80
            rounded-lg border border-border bg-bg-base p-3
            text-left text-fg-base shadow-lg
          "
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            Connectors (this conversation)
          </div>
          {error && (
            <div className="mb-2 text-[12px] text-warn-fg">Error: {error}</div>
          )}
          {!items && !error && (
            <div className="py-2 text-[13px] text-fg-muted">Loading…</div>
          )}
          {items && items.length === 0 && (
            <div className="py-2 text-[13px] text-fg-muted">
              No connectors in scope.
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="flex flex-col gap-1">
              {items.map((c) => (
                <li key={c.descriptive_id}>
                  <label
                    className={`
                      flex cursor-pointer items-start gap-2 rounded p-1.5
                      hover:bg-bg-mid
                      ${busy === c.descriptive_id ? "opacity-50" : ""}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={c.active}
                      disabled={busy === c.descriptive_id}
                      onChange={(e) => void toggle(c.descriptive_id, e.target.checked)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{c.name}</div>
                      <div className="truncate text-[11px] text-fg-muted">
                        {c.type} · {c.descriptive_id}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
