import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { MarkdownText } from "./Markdown.tsx";

interface HealthState {
  mode: "demo" | "prod";
  status: string;
}

/**
 * augchatd bundled UI — first cut.
 *
 * Per story 0007 / contract-demo-mode:
 *  - Boots, calls /healthz to learn the mode
 *  - In demo mode, fetches the JWT from /demo/jwt
 *  - Shows a "Demo session — not authenticated" banner from inside the
 *    augchatd origin (parent page cannot style or hide this)
 *  - Hands the JWT to the chat runtime; POST /chat requests carry it as
 *    a Bearer token; on 401 the JWT is re-fetched once (per
 *    contract-jwt-refresh, single recovery path)
 *
 * Production handshake (postMessage from the integrator parent page, per
 * contract-ui-handshake) is not wired yet — that comes when prod
 * POST /sessions lands.
 */
export default function App() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetch("/healthz").then((r) => r.json() as Promise<HealthState>);
        if (cancelled) return;
        setHealth(h);

        if (h.mode === "demo") {
          const j = await fetchDemoJwt();
          if (cancelled) return;
          setJwt(j);
        } else {
          setError(
            "Production mode requires a JWT via postMessage — not yet wired in this scaffold.",
          );
        }
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
      <div className="app">
        <div className="error">augchatd: {error}</div>
      </div>
    );
  }
  if (!health || !jwt) {
    return (
      <div className="app">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app">
      {health.mode === "demo" && (
        <div className="banner">Demo session — not authenticated</div>
      )}
      <ChatRoom initialJwt={jwt} />
    </div>
  );
}

async function fetchDemoJwt(): Promise<string> {
  const r = await fetch("/demo/jwt");
  if (!r.ok) throw new Error(`/demo/jwt HTTP ${r.status}`);
  const j = (await r.json()) as { jwt: string };
  return j.jwt;
}

function ChatRoom({ initialJwt }: { initialJwt: string }) {
  const jwtRef = useRef(initialJwt);

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/chat",
        headers: () => ({ Authorization: `Bearer ${jwtRef.current}` }),
        fetch: async (input, init) => {
          const r = await fetch(input, init);
          if (r.status !== 401) return r;
          // Single retry on 401 — same recovery path JWT and connector
          // credential expiry share (per contract-jwt-refresh). For
          // production, the iframe parent page supplies the fresh JWT.
          // In demo mode we just re-fetch from /demo/jwt.
          try {
            jwtRef.current = await fetchDemoJwt();
          } catch {
            return r;
          }
          const retriedHeaders = new Headers(init?.headers);
          retriedHeaders.set("Authorization", `Bearer ${jwtRef.current}`);
          return fetch(input, { ...init, headers: retriedHeaders });
        },
      }),
    [],
  );

  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="thread-shell">
        <ThreadPrimitive.Viewport className="thread-messages">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root className="composer">
          <ComposerPrimitive.Input
            placeholder="Send a message…"
            autoFocus
            rows={1}
          />
          <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="message user">
      <div className="message-role">You</div>
      <div className="message-content">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message assistant">
      <div className="message-role">Assistant</div>
      <div className="message-content">
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
      </div>
    </MessagePrimitive.Root>
  );
}
