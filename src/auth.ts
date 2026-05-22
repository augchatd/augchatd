import type { Context, Next } from "hono";
import { verifyJwt } from "./jwt.ts";
import { getSession, type SessionRecord } from "./session-registry.ts";

/**
 * JWT-bearer auth middleware.
 *
 * Per contract-jwt-refresh: an invalid or expired JWT returns 401 to the
 * browser. The browser's iframe runtime takes the refresh path from
 * there. We do not distinguish between "missing", "malformed", or
 * "expired" — all surface as 401 (single recovery code path).
 */

type AuthedVars = {
  session: SessionRecord;
};

export async function requireSession(
  c: Context<{ Variables: AuthedVars }>,
  next: Next,
): Promise<Response | void> {
  const header = c.req.header("Authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return c.json({ error: "missing_jwt" }, 401);
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return c.json({ error: "invalid_jwt" }, 401);
  }

  const session = getSession(payload.sid);
  if (!session) {
    // Signature valid, but the session record is gone — e.g. process
    // restart, or DELETE /sessions cleared it. Same recovery path.
    return c.json({ error: "session_gone" }, 401);
  }

  c.set("session", session);
  await next();
}
