import { Hono } from "hono";
import { healthzHandler } from "./routes/healthz.ts";
import { demoJwtHandler } from "./routes/demo-jwt.ts";
import { demoSessionsHandler } from "./routes/demo-sessions.ts";
import { demoPageHandler } from "./routes/demo-page.ts";
import { chatHandler } from "./routes/chat.ts";
import {
  createConversationHandler,
  listConversationConnectorsHandler,
  listConversationMessagesHandler,
  setConversationConnectorStateHandler,
  setConversationModelHandler,
} from "./routes/conversations.ts";
import { listSessionModelsHandler } from "./routes/models.ts";
import { requireSession } from "./auth.ts";
import { mountStaticUi } from "./routes/static-ui.ts";
import type { BootConfig } from "./env.ts";

/**
 * Build the Hono app for the current boot config.
 *
 * Demo mode (per contract-demo-mode):
 *   - GET  /healthz         — exposed
 *   - GET  /demo/           — exposed; "integrator" wrapper page that
 *                              iframes the UI and runs the postMessage
 *                              handshake against POST /demo/sessions
 *   - POST /demo/sessions   — exposed; mints a fresh session from env
 *   - GET  /demo/jwt        — exposed (legacy; removed once UI migrates)
 *   - POST /chat            — exposed (JWT bearer; demo session bound at boot)
 *   - POST /sessions        — NOT mounted (returns 404 by default)
 *   - DELETE /sessions/*    — NOT mounted (returns 404 by default)
 *   - GET  /, /assets/*     — bundled UI (static)
 *
 * Production mode (placeholder until session minting lands):
 *   - GET /healthz       — exposed
 *   - everything else    — to come
 */
const API_PATHS = ["/healthz", "/demo", "/chat", "/sessions", "/conversations", "/session"];

export function createApp(config: BootConfig): Hono {
  const app = new Hono();

  app.get("/healthz", healthzHandler(config.mode));

  if (config.mode === "demo" && config.demo) {
    // Specific routes first so they win over the wildcard below.
    app.get("/demo/jwt", demoJwtHandler(config.demo));
    app.post("/demo/sessions", demoSessionsHandler(config.demo));
    app.get("/demo", demoPageHandler);
    // Wildcard so the wrapper page also serves /demo/c/<cid> etc. —
    // lets us mirror the iframe's internal route into a real URL path
    // (instead of a fragment) so it shows up in server logs.
    app.get("/demo/*", demoPageHandler);
    app.post("/chat", requireSession, chatHandler);
    app.post("/conversations", requireSession, createConversationHandler);
    app.get(
      "/conversations/:conversation_id/connectors",
      requireSession,
      listConversationConnectorsHandler,
    );
    app.put(
      "/conversations/:conversation_id/connectors/:descriptive_id",
      requireSession,
      setConversationConnectorStateHandler,
    );
    app.put(
      "/conversations/:conversation_id/model",
      requireSession,
      setConversationModelHandler,
    );
    app.get("/session/models", requireSession, listSessionModelsHandler);
    app.get(
      "/conversations/:conversation_id/messages",
      requireSession,
      listConversationMessagesHandler,
    );
  }

  // UI serving is mode-agnostic; in prod the UI handshake gets the JWT
  // from the integrator parent page via postMessage (per contract-ui-handshake).
  mountStaticUi(app, (p) =>
    API_PATHS.some((api) => p === api || p.startsWith(`${api}/`)),
  );

  return app;
}
