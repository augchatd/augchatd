import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Renders Markdown text with GFM + syntax-highlighted code blocks
 * (via rehype-highlight; the .hljs token colors live in index.css).
 *
 * Plugged into assistant-ui's MessagePrimitive.Parts via the `Text`
 * component override — assistant-ui hands us the raw text part, we
 * choose how to render it. Default is plain text; this swaps it for
 * Markdown-aware rendering.
 *
 * For streaming responses, react-markdown re-renders on each delta;
 * partial fences / lists / etc. render as text until the closing
 * token arrives, then re-parse as Markdown.
 */
export function MarkdownText({ text }: { text: string }) {
  return (
    <div
      className="
        prose-invert max-w-none leading-relaxed
        [&_p]:my-2
        [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold
        [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold
        [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold
        [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6
        [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6
        [&_li]:my-0.5
        [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline
        [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-fg-muted
        [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-bg-mid [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:font-mono
        [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-[#050507] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[0.9em] [&_pre]:leading-relaxed
        [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_table]:my-3 [&_table]:border-collapse [&_table]:text-[0.95em]
        [&_th]:border [&_th]:border-border [&_th]:bg-bg-soft [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left
        [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5
        [&_hr]:my-4 [&_hr]:border-border
        [&>:first-child]:mt-0 [&>:last-child]:mb-0
      "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
