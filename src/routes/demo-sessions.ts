import type { Context } from "hono";
import { mintJwt } from "../jwt.ts";
import { bindDemoSession } from "../session-registry.ts";
import type { DemoModeConfig } from "../env.ts";

/**
 * POST /demo/sessions — exposed only when AUGCHATD_MODE=demo.
 *
 * Mints a fresh session from the boot-time env config and returns a JWT.
 * Each call creates a new `session_id` (UUID); all such sessions share
 * the same (tenant="demo", user="demo") hot SQLite — multiple browser
 * tabs each get their own session and their conversations co-mingle in
 * the same per-user store (which matches what production does for two
 * concurrent sessions of the same user).
 *
 * Mirrors the production POST /sessions surface (see
 * contract-session-create) so the demo wrapper page (GET /demo/) can
 * exercise the same iframe + postMessage handshake an integrator will
 * use in production.
 *
 * Response: `{ session_id, jwt, expires_at, theme }`.
 */
export function demoSessionsHandler(demoConfig: DemoModeConfig) {
  return async (c: Context): Promise<Response> => {
    const sessionId = crypto.randomUUID();
    bindDemoSession(sessionId, demoConfig);
    const { jwt, expires_at } = await mintJwt(sessionId, demoConfig.ttl_seconds);
    return c.json({
      session_id: sessionId,
      jwt,
      expires_at,
      theme: demoConfig.theme,
    });
  };
}
