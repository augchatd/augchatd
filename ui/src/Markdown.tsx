import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

/**
 * Renders Markdown text with GFM + syntax-highlighted code blocks
 * (via rehype-highlight backed by highlight.js, dark theme).
 *
 * Plugged into assistant-ui's MessagePrimitive.Parts via the `Text`
 * component override — assistant-ui hands us the raw text part, we
 * choose how to render it. Default is plain text; this swaps it for
 * Markdown-aware rendering.
 *
 * For streaming responses, react-markdown re-renders on each delta;
 * partial fences / lists / etc. render as text until the closing
 * token arrives, then re-parse as Markdown. Acceptable for chat.
 */
export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
