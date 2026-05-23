import type { Context } from "hono";
import { mintJwt } from "../jwt.ts";
import type { DemoModeConfig } from "../env.ts";

const DEMO_SESSION_ID = "demo-session";

/**
 * GET /demo/jwt — exposed only when AUGCHATD_MODE=demo.
 *
 * Per technical-contract-http-get-demo-jwt: no auth, returns `{ jwt }`.
 * The single demo session is bound at process boot from environment
 * variables (see env.ts).
 */
export function demoJwtHandler(demoConfig: DemoModeConfig) {
  return async (c: Context): Promise<Response> => {
    const { jwt } = await mintJwt(DEMO_SESSION_ID, demoConfig.ttl_seconds);
    // `theme` rides along so the bundled UI can apply the right palette
    // on first paint without a separate round-trip. In production this
    // will come from the postMessage handshake with the integrator
    // (matching what POST /sessions accepted).
    return c.json({ jwt, theme: demoConfig.theme });
  };
}
