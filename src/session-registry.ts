import type { DemoModeConfig } from "./env.ts";
import { parseConnectors, type Connector } from "./connectors.ts";

/**
 * In-memory session registry. Source of truth for credentials and scope
 * (per adr-0005-jwt-signature-only — the JWT only carries the session
 * id; everything else lives here).
 */

export interface SessionRecord {
  session_id: string;
  /**
   * Tenant the session belongs to (per constraint-tenant-isolation +
   * contract-storage-hot's `data/<tenantId>/<userId>.sqlite` layout).
   * In demo mode: `"demo"`.
   */
  tenant_id: string;
  user_id: string;
  system_prompt: string;
  model: {
    provider: string;
    model_id: string;
    api_key: string;
  };
  s3_uri: string | undefined;
  /** Typed connectors[]; empty if the session didn't declare any. */
  connectors: Connector[];
}

const registry = new Map<string, SessionRecord>();

export function registerSession(record: SessionRecord): void {
  registry.set(record.session_id, record);
}

export function getSession(sessionId: string): SessionRecord | undefined {
  return registry.get(sessionId);
}

export function bindDemoSession(
  sessionId: string,
  config: DemoModeConfig,
): SessionRecord {
  const record: SessionRecord = {
    session_id: sessionId,
    tenant_id: "demo",
    user_id: "demo",
    system_prompt: config.system_prompt,
    model: config.model,
    s3_uri: config.s3_uri,
    connectors: parseConnectors(config.connectors_raw),
  };
  registerSession(record);
  return record;
}
