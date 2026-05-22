/**
 * Typed connector model.
 *
 * Per ADR-0010, the session payload's `connectors[]` is a list of typed
 * providers with common fields plus type-specific config. This file
 * defines the discriminated union and a parser that turns the raw JSON
 * (DEMO_CONNECTORS env or DEMO_CONNECTORS_FILE contents, or the
 * production POST /sessions body) into typed records.
 *
 * Validation rules mirror contract-session-create:
 *  - common fields required (descriptive_id, name, type, default_active)
 *  - descriptive_id unique within the list
 *  - type-specific required fields present
 *  - for type: "rag", backend === "opensearch" only (pgvector deferred,
 *    see pressure-pgvector-backend)
 */

export interface CommonConnector {
  descriptive_id: string;
  name: string;
  default_active: boolean;
}

export interface McpConnector extends CommonConnector {
  type: "mcp";
  url: string;
  auth: Record<string, unknown>;
}

export interface RagConnector extends CommonConnector {
  type: "rag";
  backend: "opensearch";
  cluster: string;
  auth: Record<string, unknown>;
  indexes: string[];
}

export type Connector = McpConnector | RagConnector;

export function parseConnectors(rawJson: string | undefined): Connector[] {
  if (!rawJson) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`connectors[]: not valid JSON (${(e as Error).message})`);
  }
  if (!Array.isArray(arr)) {
    throw new Error("connectors[]: must be a JSON array");
  }

  const out: Connector[] = [];
  const seen = new Set<string>();
  for (const [i, entry] of arr.entries()) {
    const conn = parseEntry(entry, i);
    if (seen.has(conn.descriptive_id)) {
      throw new Error(
        `connectors[${i}]: duplicate descriptive_id "${conn.descriptive_id}"`,
      );
    }
    seen.add(conn.descriptive_id);
    out.push(conn);
  }
  return out;
}

function parseEntry(entry: unknown, i: number): Connector {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`connectors[${i}]: must be an object`);
  }
  const e = entry as Record<string, unknown>;
  const descriptive_id = str(e, "descriptive_id", i);
  const name = str(e, "name", i);
  const default_active = bool(e, "default_active", i);
  const type = str(e, "type", i);

  if (type === "mcp") {
    const url = str(e, "url", i);
    const auth = obj(e, "auth", i);
    return { type, descriptive_id, name, default_active, url, auth };
  }
  if (type === "rag") {
    const backend = str(e, "backend", i);
    if (backend !== "opensearch") {
      throw new Error(
        `connectors[${i}]: backend "${backend}" not supported (only "opensearch"; pgvector is deferred)`,
      );
    }
    const cluster = str(e, "cluster", i);
    const auth = obj(e, "auth", i);
    const indexes = arrStr(e, "indexes", i);
    return {
      type,
      descriptive_id,
      name,
      default_active,
      backend,
      cluster,
      auth,
      indexes,
    };
  }
  throw new Error(`connectors[${i}]: unknown type "${type}"`);
}

function str(e: Record<string, unknown>, key: string, i: number): string {
  const v = e[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`connectors[${i}]: field "${key}" must be a non-empty string`);
  }
  return v;
}

function bool(e: Record<string, unknown>, key: string, i: number): boolean {
  const v = e[key];
  if (typeof v !== "boolean") {
    throw new Error(`connectors[${i}]: field "${key}" must be a boolean`);
  }
  return v;
}

function obj(e: Record<string, unknown>, key: string, i: number): Record<string, unknown> {
  const v = e[key];
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`connectors[${i}]: field "${key}" must be an object`);
  }
  return v as Record<string, unknown>;
}

function arrStr(e: Record<string, unknown>, key: string, i: number): string[] {
  const v = e[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new Error(`connectors[${i}]: field "${key}" must be an array of strings`);
  }
  return v as string[];
}
