import { useState, type ReactNode } from "react";

/**
 * Visual frame around a fenced block (top bar with language label +
 * copy button, body slot). Shared by regular code blocks (highlighted),
 * JsonBlock, and CsvBlock.
 */
export function CodeBlockShell({
  language,
  rawCode,
  children,
}: {
  language: string;
  rawCode: string;
  children: ReactNode;
}) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-[#050507]">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-1.5 text-xs">
        <span className="font-mono uppercase tracking-wider text-fg-muted">
          {language || "code"}
        </span>
        <CopyButton text={rawCode} />
      </div>
      {children}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // ignore
        }
      }}
      className="rounded px-2 py-0.5 text-fg-muted hover:bg-bg-mid hover:text-fg-base"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
