import type { Context } from "hono";
import type { AugchatdMode } from "../env.ts";

/**
 * GET /healthz — exposed on both modes.
 *
 * Per technical-contract-http-get-healthz: the `mode` field is the
 * deploy-safety gate. Operators fail their production deploy when
 * `mode: "demo"` shows up on a production health check.
 */
export function healthzHandler(mode: AugchatdMode) {
  return (c: Context) => c.json({ mode, status: "ok" });
}
