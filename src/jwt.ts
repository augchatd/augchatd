import { sign, verify } from "hono/jwt";

/**
 * JWT minting and signature-only verification.
 *
 * Per adr-0005-jwt-signature-only: no DB lookup per request; the JWT
 * carries the session id and an exp, and the in-memory session registry
 * is the source of truth for credentials/scope at chat time.
 *
 * For demo mode (this scaffold), the symmetric secret is generated once
 * at process boot. Process restart invalidates every previously-issued
 * JWT — which is fine, because demo state does not survive restart
 * anyway (no cold storage unless DEMO_S3_URI is set, and even then the
 * session itself is process-bound).
 *
 * Production minting (forthcoming with POST /sessions) will use a
 * configurable secret or asymmetric keys; that is not in this commit.
 */

const SECRET_BYTES = 32;

const secret: string = (() => {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
})();

export interface JwtPayload {
  /** session_id this JWT authorizes against the in-memory registry. */
  sid: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expires-at, unix seconds. */
  exp: number;
}

export async function mintJwt(
  sessionId: string,
  ttlSeconds: number,
): Promise<{ jwt: string; expires_at: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const payload: JwtPayload = { sid: sessionId, iat: now, exp };
  const jwt = await sign(payload, secret);
  return { jwt, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * Returns the decoded payload if the signature is valid and the token is
 * not expired; null otherwise. Used by JWT-authenticated routes.
 */
export async function verifyJwt(jwt: string): Promise<JwtPayload | null> {
  try {
    const payload = (await verify(jwt, secret)) as unknown as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}
