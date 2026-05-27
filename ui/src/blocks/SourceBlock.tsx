/**
 * Source chip — handles both source-url and source-document parts.
 *
 * The chat backend emits `source-document` UIMessagePart per RAG hit
 * (see chat.ts onStepFinish + rag.ts consumeRagHits). assistant-ui
 * converts the AI-SDK part shape into its own
 * `{ type:"source", sourceType:"document"|"url", id, ... }` shape
 * before passing it to this component (see
 * @assistant-ui/core types/message.d.ts SourceMessagePart).
 *
 * Document collapsed: 📄 <title> · <connector> · <score>
 * URL collapsed:      🔗 <title or url>
 * Expanded:           connector / index / id / score / snippet
 */

type AugchatdMetadata = {
  source_descriptive_id?: string;
  index?: string;
  doc_id?: string;
  score?: number | null;
  snippet?: string;
};

type SourceProps =
  | {
      type: "source";
      sourceType: "document";
      id: string;
      title: string;
      mediaType: string;
      filename?: string;
      providerMetadata?: { [provider: string]: unknown };
    }
  | {
      type: "source";
      sourceType: "url";
      id: string;
      url: string;
      title?: string;
      providerMetadata?: { [provider: string]: unknown };
    };

export function SourceBlock(props: SourceProps) {
  if (props.sourceType === "url") {
    return (
      <a
        href={props.url}
        target="_blank"
        rel="noreferrer noopener"
        className="
          my-1 mr-1 inline-flex max-w-full items-center gap-1 align-top
          rounded-md border border-border bg-bg-soft px-2 py-1 text-[12px]
          text-fg-base hover:bg-bg-mid
        "
      >
        <span aria-hidden>🔗</span>
        <span className="truncate">{props.title ?? props.url}</span>
      </a>
    );
  }

  const meta =
    (props.providerMetadata?.["augchatd"] as AugchatdMetadata | undefined) ?? {};
  const scoreLabel =
    typeof meta.score === "number" ? meta.score.toFixed(2) : null;

  return (
    <details
      className="
        my-1 mr-1 inline-block max-w-full align-top
        rounded-md border border-border bg-bg-soft text-[12px]
      "
    >
      <summary
        className="
          cursor-pointer list-none select-none px-2 py-1
          text-fg-base hover:bg-bg-mid
          [&::-webkit-details-marker]:hidden
        "
      >
        <span aria-hidden className="mr-1">📄</span>
        <span className="font-medium">{props.title}</span>
        {meta.source_descriptive_id && (
          <span className="ml-2 text-fg-muted">
            · {meta.source_descriptive_id}
          </span>
        )}
        {scoreLabel && (
          <span className="ml-2 tabular-nums text-fg-muted">· {scoreLabel}</span>
        )}
      </summary>
      <div className="border-t border-border px-2 py-2 text-fg-muted">
        <div className="mb-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[11px]">
          {meta.source_descriptive_id && (
            <>
              <span className="text-fg-muted/70">connector</span>
              <span className="text-fg-base">{meta.source_descriptive_id}</span>
            </>
          )}
          {meta.index && (
            <>
              <span className="text-fg-muted/70">index</span>
              <span className="break-all text-fg-base">{meta.index}</span>
            </>
          )}
          {meta.doc_id && (
            <>
              <span className="text-fg-muted/70">id</span>
              <span className="break-all text-fg-base">{meta.doc_id}</span>
            </>
          )}
          {scoreLabel && (
            <>
              <span className="text-fg-muted/70">score</span>
              <span className="text-fg-base">{scoreLabel}</span>
            </>
          )}
        </div>
        {meta.snippet && (
          <div className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-fg-base">
            {meta.snippet}
          </div>
        )}
      </div>
    </details>
  );
}
