import { Hono } from "hono";
import { healthzHandler } from "./routes/healthz.ts";
import { demoJwtHandler } from "./routes/demo-jwt.ts";
import { chatHandler } from "./routes/chat.ts";
import { requireSession } from "./auth.ts";
import { mountStaticUi } from "./routes/static-ui.ts";
import type { BootConfig } from "./env.ts";

/**
 * Build the Hono app for the current boot config.
 *
 * Demo mode (per contract-demo-mode):
 *   - GET  /healthz         — exposed
 *   - GET  /demo/jwt        — exposed
 *   - POST /chat            — exposed (JWT bearer; demo session bound at boot)
 *   - POST /sessions        — NOT mounted (returns 404 by default)
 *   - DELETE /sessions/*    — NOT mounted (returns 404 by default)
 *   - GET  /, /assets/*     — bundled UI (static)
 *
 * Production mode (placeholder until session minting lands):
 *   - GET /healthz       — exposed
 *   - everything else    — to come
 */
const API_PATHS = ["/healthz", "/demo/jwt", "/chat", "/sessions"];

export function createApp(config: BootConfig): Hono {
  const app = new Hono();

  app.get("/healthz", healthzHandler(config.mode));

  if (config.mode === "demo" && config.demo) {
    app.get("/demo/jwt", demoJwtHandler(config.demo));
    app.post("/chat", requireSession, chatHandler);
  }

  // UI serving is mode-agnostic; in prod the UI handshake gets the JWT
  // from the integrator parent page via postMessage (per contract-ui-handshake).
  mountStaticUi(app, (p) =>
    API_PATHS.some((api) => p === api || p.startsWith(`${api}/`)),
  );

  return app;
}
