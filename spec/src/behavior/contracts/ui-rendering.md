---
id: contract-ui-rendering
type: behavior-contract
status: proposed
capability: cap-ui
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (bundled UI)"
links:
  - relation: satisfies
    target: req-007-bundled-ui
  - relation: depends_on
    target: contract-ui-handshake
---

# Contract — UI rendering catalog

What content shapes the bundled UI knows how to render in an assistant message. The shapes are inferred from the assistant-ui `UIMessagePart` stream emitted by the chat backend ([contract-session-chat](session-chat.md)) — the UI renders the parts; it does not parse them.

## In scope (assistant messages)

Markdown body (text parts) is rendered with these extensions:

- **GFM Markdown** — tables, task lists, autolinks, strikethrough (`remark-gfm`).
- **LaTeX math** — `$inline$` and `$$block$$` (`remark-math` + `rehype-katex`).
- **Mermaid diagrams** — `​```mermaid` fences; diagram library is lazy-loaded on first use.
- **JSON viewer** — `​```json` fences render as a structured, inspectable tree (not raw text).
- **CSV viewer** — `​```csv` fences (with header row) render as a sortable HTML table.
- **Inline HTML / SVG** — sanitized via `rehype-sanitize` with an SVG-friendly tag/attribute allowlist; `<script>`, event handlers, and other unsafe markup are stripped.
- **Fenced code (any other language)** — syntax highlighting via `rehype-highlight` (highlight.js), plus a per-block **copy button** and a language label, wrapped by `CodeBlockShell`.

Non-Markdown parts emitted by the backend:

- **Image parts** — rendered as `<img>` (URL-based; base64 inline images are not supported).
- **Reasoning parts** — collapsible `<details>` block, off by default.
- **Tool-call parts** — compact pill per call (connector name + tool name + status). Consecutive tool calls within the same assistant message are visually grouped via `ToolGroup`.
- **Source parts** — RAG hits, rendered as clickable chips beneath the message; carry `descriptive_id`, `index`, `doc_id`, `score`, `snippet` (see [contract-rag-query](rag-query.md)).
- **Model-provenance chip** — a small per-message badge showing `model_id` / `provider`, derived from `message.metadata.augchatd` ([contract-session-chat](session-chat.md)).

Per-thread UI surfaces (not per-message):

- **`ActionBar`** — Copy, Regenerate (per assistant message).
- **`BranchPicker`** — prev / next sibling (when the user has regenerated).
- **`Suggestions`** — clickable prompt shortcuts shown on the empty-thread state.

## Out of scope (explicit non-promises)

- **No `shiki`** — syntax highlighting uses `highlight.js` via `rehype-highlight`; richer language grammars require switching highlighter, which is not promised.
- **No `papaparse`** — CSV is parsed with a minimal built-in splitter; complex CSV (embedded newlines in quoted fields, custom delimiters) is best-effort.
- **No inline-execution sandboxes** — fenced `python` / `js` / etc. is highlighted, not run. No Pyodide, no WebContainers.
- **No voice / audio playback** of assistant output.
- **No runtime theme switching** — the theme is fixed for the session at first handshake (per [contract-ui-handshake](ui-handshake.md)). A new session can choose a different theme; mid-session toggling is not exposed.

## User messages

Rendered as plain text (with `whitespace: pre-wrap`). No Markdown, no syntax highlighting — preserves what the user typed verbatim.

## Related

- [contract-ui-handshake](ui-handshake.md) — how the UI obtains its JWT and theme
- [contract-session-chat](session-chat.md) — the stream protocol that produces these parts
- [adr-0009-react-vite-bundled-ui](../../architecture/adrs/0009-react-vite-bundled-ui.md) — the underlying stack
