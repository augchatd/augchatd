import { Hono } from "hono";
import { healthzHandler } from "./routes/healthz.ts";
import { demoJwtHandler } from "./routes/demo-jwt.ts";
import type { BootConfig } from "./env.ts";

/**
 * Build the Hono app for the current boot config.
 *
 * Demo mode (per contract-demo-mode):
 *   - GET /healthz       — exposed
 *   - GET /demo/jwt      — exposed
 *   - POST /sessions     — NOT mounted (returns 404 by default)
 *   - DELETE /sessions/* — NOT mounted (returns 404 by default)
 *
 * Production mode (placeholder until session minting lands):
 *   - GET /healthz       — exposed
 *   - everything else    — to come
 */
export function createApp(config: BootConfig): Hono {
  const app = new Hono();

  app.get("/healthz", healthzHandler(config.mode));

  if (config.mode === "demo" && config.demo) {
    app.get("/demo/jwt", demoJwtHandler(config.demo));
  }

  return app;
}
