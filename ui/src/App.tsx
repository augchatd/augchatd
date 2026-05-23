import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import { MarkdownText } from "./Markdown.tsx";
import { ToolCallBlock, ToolGroup } from "./blocks/ToolCallBlock.tsx";
import { SourceBlock } from "./blocks/SourceBlock.tsx";
import { ConnectorsMenu } from "./ConnectorsMenu.tsx";
import { ModelPicker } from "./ModelPicker.tsx";

type AuthedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface BootState {
  cid: string;
  initialMessages: UIMessage[];
}
// CitationsPanel temporarily removed — the useThread selector returned a
// new array each render, triggering React error #185 (max update depth).
// Reintroduce with the imperative useThreadRuntime + subscribe pattern
// when RAG-type connectors actually emit source-url / source-document
// parts. Tracked in augchatd/augchatd#5.

interface HealthState {
  mode: "demo" | "prod";
  status: string;
}

const SUGGESTIONS = [
  "Show me a Mermaid flowchart for an HTTP request.",
  "Render a small JSON object for a user record.",
  "Explain Euler's identity with LaTeX.",
];

/**
 * augchatd bundled UI.
 *
 * Per story 0007 / contract-demo-mode:
 *  - Boots, calls /healthz to learn the mode.
 *  - In demo mode, fetches the JWT from /demo/jwt.
 *  - Shows a "Demo session — not authenticated" banner from inside
 *    the augchatd origin (parent page cannot style or hide it).
 *  - Hands the JWT to the chat runtime; POST /chat carries it as a
 *    Bearer token; on 401 the JWT is re-fetched once (per
 *    contract-jwt-refresh, single recovery path).
 *
 * Production handshake (postMessage from the integrator parent page,
 * per contract-ui-handshake) is not wired yet — that comes when prod
 * POST /sessions lands.
 */
export default function App() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [boot, setBoot] = useState<BootState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetch("/healthz").then((r) => r.json() as Promise<HealthState>);
        if (cancelled) return;
        setHealth(h);

        if (h.mode !== "demo") {
          setError(
            "Production mode requires a JWT via postMessage — not yet wired in this scaffold.",
          );
          return;
        }

        const j = await fetchDemoJwt();
        if (cancelled) return;
        setJwt(j);

        const b = await resolveBootConversation(j);
        if (cancelled) return;
        setBoot(b);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-warn-fg">
        augchatd: {error}
      </div>
    );
  }
  if (!health || !jwt || !boot) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-fg-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {health.mode === "demo" && (
        <div className="border-b border-warn-border bg-warn-bg px-4 py-2 text-center text-[13px] font-medium tracking-wide text-warn-fg">
          Demo session — not authenticated
        </div>
      )}
      <ChatRoom
        key={boot.cid}
        initialJwt={jwt}
        conversationId={boot.cid}
        initialMessages={boot.initialMessages}
      />
    </div>
  );
}

/**
 * Resolve which conversation_id to use on boot, hydrating server-side
 * messages when possible. URL convention: `/c/<conversation_id>`.
 *
 *   no path / unknown cid → mint a fresh conversation, replaceState
 *   /c/<cid> with messages → hydrate
 *   /c/<cid> with 404      → mint fresh + replaceState
 *
 * Auth boundary is implicit: the per-(tenant, user) SQLite partition
 * makes cids from other users resolve to `conversation_not_found`. No
 * extra check needed here.
 */
async function resolveBootConversation(jwt: string): Promise<BootState> {
  const match = /^\/c\/([^/?#]+)/.exec(window.location.pathname);
  const urlCid = match?.[1];

  if (urlCid) {
    const r = await fetch(`/conversations/${encodeURIComponent(urlCid)}/messages`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (r.ok) {
      const data = (await r.json()) as {
        messages: Array<{ message_id: string; role: string; parts: unknown }>;
      };
      const initialMessages: UIMessage[] = (data.messages ?? []).map((m) => ({
        id: m.message_id,
        role: m.role as UIMessage["role"],
        parts: m.parts as UIMessage["parts"],
      }));
      return { cid: urlCid, initialMessages };
    }
    // 404 (or other) — fall through to mint fresh.
  }

  // Mint via POST /conversations. Server returns a UUID.
  const r = await fetch("/conversations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!r.ok) throw new Error(`POST /conversations HTTP ${r.status}`);
  const { conversation_id } = (await r.json()) as { conversation_id: string };
  window.history.replaceState(null, "", `/c/${conversation_id}`);
  return { cid: conversation_id, initialMessages: [] };
}

async function fetchDemoJwt(): Promise<string> {
  const r = await fetch("/demo/jwt");
  if (!r.ok) throw new Error(`/demo/jwt HTTP ${r.status}`);
  const j = (await r.json()) as { jwt: string };
  return j.jwt;
}

function ChatRoom({
  initialJwt,
  conversationId,
  initialMessages,
}: {
  initialJwt: string;
  conversationId: string;
  initialMessages: UIMessage[];
}) {
  const jwtRef = useRef(initialJwt);

  // Shared "authed fetch" for admin endpoints (model picker, connector toggle).
  // Mirrors the JWT refresh logic in the chat transport below.
  const authedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const withAuth = (token: string): RequestInit => {
        const h = new Headers(init?.headers);
        h.set("Authorization", `Bearer ${token}`);
        return { ...init, headers: h };
      };
      const first = await fetch(input, withAuth(jwtRef.current));
      if (first.status !== 401) return first;
      try {
        jwtRef.current = await fetchDemoJwt();
      } catch {
        return first;
      }
      return fetch(input, withAuth(jwtRef.current));
    },
    [],
  );

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/chat",
        headers: () => ({ Authorization: `Bearer ${jwtRef.current}` }),
        fetch: async (input, init) => {
          const r = await fetch(input, init);
          if (r.status !== 401) return r;
          try {
            jwtRef.current = await fetchDemoJwt();
          } catch {
            return r;
          }
          const retriedHeaders = new Headers(init?.headers);
          retriedHeaders.set("Authorization", `Bearer ${jwtRef.current}`);
          return fetch(input, { ...init, headers: retriedHeaders });
        },
        // Override `body.id` to use OUR conversation_id (the one in
        // the URL / hydrated from POST /conversations) instead of the
        // assistant-ui-internal threadListItem.id. assistant-ui's id
        // stays client-local; the server sees only our cid, which is
        // what the SQLite row keys on.
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
          body: { id: conversationId, messages, trigger, messageId },
        }),
      }),
    [conversationId],
  );

  const runtime = useChatRuntime({ transport, messages: initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-thread flex-col gap-6 px-4 py-8">
            <ThreadPrimitive.Empty>
              <EmptyState />
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages
              components={{ UserMessage, AssistantMessage }}
            />
          </div>
        </ThreadPrimitive.Viewport>
        <Composer conversationId={conversationId} authedFetch={authedFetch} />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-bg-soft p-6">
      <div className="mb-1 text-fg-base">Try a question.</div>
      <div className="mb-4 text-[13px] text-fg-muted">
        The session uses the model and key bound at boot from env vars.
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((text) => (
          <ThreadPrimitive.Suggestion
            key={text}
            prompt={text}
            method="replace"
            autoSend
            className="rounded-full border border-border bg-bg-mid px-3 py-1 text-[13px] text-fg-base hover:bg-bg-base"
          >
            {text}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col items-end gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        You
      </div>
      <div className="rounded-2xl rounded-tr-md border border-border bg-bg-mid px-4 py-2.5 max-w-[85%] whitespace-pre-wrap">
        <MessagePrimitive.Parts components={{ Image: ImagePart }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        Assistant
      </div>
      <div className="rounded-2xl rounded-tl-md border border-border bg-bg-soft px-4 py-3 max-w-[95%]">
        {/* While the response is still in flight and no content has
            arrived (no text-delta, no tool-call), the bubble was
            collapsing to a thin empty rectangle that looked broken.
            Three pulsing dots fill the gap; they disappear as soon
            as any part lands. */}
        <MessagePrimitive.If hasContent={false}>
          <ThinkingDots />
        </MessagePrimitive.If>
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            Image: ImagePart,
            Reasoning: ReasoningPart,
            Source: SourceBlock,
            tools: { Fallback: ToolCallBlock },
            ToolGroup,
          }}
        />
      </div>
      <div className="mt-1 flex items-center gap-1 text-fg-muted">
        <AssistantActionBar />
        <BranchPicker />
      </div>
    </MessagePrimitive.Root>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5" aria-label="thinking">
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

function ReasoningPart({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="my-2 rounded-lg border border-border bg-bg-base p-2 text-fg-muted">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider">
        Reasoning
      </summary>
      <div className="mt-2 whitespace-pre-wrap font-mono text-[0.85em] leading-relaxed">
        {text}
      </div>
    </details>
  );
}

function ImagePart({ image }: { image?: string }) {
  if (!image) return null;
  return <img src={image} alt="" className="my-3 max-h-96 max-w-full rounded-lg" />;
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center gap-0.5"
    >
      <ActionBarPrimitive.Copy asChild>
        <button
          type="button"
          aria-label="Copy"
          className="rounded px-2 py-0.5 text-xs hover:bg-bg-mid hover:text-fg-base"
        >
          <MessagePrimitive.If copied>Copied</MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>Copy</MessagePrimitive.If>
        </button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <button
          type="button"
          aria-label="Regenerate"
          className="rounded px-2 py-0.5 text-xs hover:bg-bg-mid hover:text-fg-base"
        >
          Regenerate
        </button>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

function BranchPicker() {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className="flex items-center gap-1 text-xs"
    >
      <BranchPickerPrimitive.Previous asChild>
        <button
          type="button"
          aria-label="Previous branch"
          className="rounded px-1.5 py-0.5 hover:bg-bg-mid hover:text-fg-base"
        >
          ←
        </button>
      </BranchPickerPrimitive.Previous>
      <span className="tabular-nums">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <button
          type="button"
          aria-label="Next branch"
          className="rounded px-1.5 py-0.5 hover:bg-bg-mid hover:text-fg-base"
        >
          →
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

function Composer({
  conversationId,
  authedFetch,
}: {
  conversationId: string;
  authedFetch: AuthedFetch;
}) {
  // conversationId comes from the URL (/c/<cid>) via App → ChatRoom →
  // here. The chat transport's prepareSendMessagesRequest also uses
  // this same id as body.id, so toolbar GET/PUT and /chat hit the
  // same SQLite row.
  return (
    <div className="border-t border-border bg-bg-base">
      <div className="mx-auto flex w-full max-w-thread flex-col gap-2 px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <ModelPicker conversationId={conversationId} authedFetch={authedFetch} />
          <ConnectorsMenu conversationId={conversationId} authedFetch={authedFetch} />
        </div>
        <ComposerPrimitive.Root className="flex items-end gap-2">
          <ComposerPrimitive.Input
            placeholder="Send a message…"
            autoFocus
            rows={1}
            className="
              flex-1 resize-none rounded-lg border border-border bg-bg-soft px-3 py-2
              text-fg-base placeholder:text-fg-muted
              focus:border-accent focus:outline-none
              min-h-[40px] max-h-[200px]
            "
          />
          <ComposerPrimitive.Send className="rounded-lg bg-accent px-4 py-2 font-semibold text-bg-base hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            Send
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}
