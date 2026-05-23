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
  /**
   * Optional free-form description of *what content/data lives behind this
   * connector*. Surfaced to the LLM:
   *   - For RAG: prepended to the retrieve tool's description, so the LLM
   *     knows what the corpus is about without speculative queries.
   *   - For MCP: prepended to each tool's description as a connector-level
   *     hint — helps the LLM pick between multiple MCP connectors when
   *     their per-tool descriptions overlap.
   */
  description: string | undefined;
}

export interface McpConnector extends CommonConnector {
  type: "mcp";
  url: string;
  auth: Record<string, unknown>;
  /**
   * Safety gate: when true (default), augchatd only exposes tools the
   * MCP server flags as read-only (or whose names look read-y). Set to
   * false to allow writes — explicit integrator opt-in.
   */
  read_only: boolean;
}

export interface RagConnector extends CommonConnector {
  type: "rag";
  backend: "opensearch";
  cluster: string;
  auth: Record<string, unknown>;
  indexes: string[];
  /**
   * Optional natural-language hint about the corpus, used to tell the LLM
   * which language to phrase its retrieval query in. BM25 is lexical: a
   * query in PT won't match a corpus in FR without semantic embeddings.
   * Surfaced in the retrieve tool's description so the LLM picks the
   * right language. Free-form (e.g. "fr", "French", "fr-CH", "pt-BR + en").
   */
  language: string | undefined;
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
  const description = optStr(e, "description", i);
  const type = str(e, "type", i);

  if (type === "mcp") {
    const url = str(e, "url", i);
    const auth = obj(e, "auth", i);
    const read_only = e["read_only"] === undefined ? true : boolField(e, "read_only", i);
    return { type, descriptive_id, name, default_active, description, url, auth, read_only };
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
    const languageRaw = e["language"];
    const language =
      languageRaw === undefined
        ? undefined
        : typeof languageRaw === "string" && languageRaw.length > 0
          ? languageRaw
          : (() => {
              throw new Error(`connectors[${i}]: field "language" must be a non-empty string when set`);
            })();
    return {
      type,
      descriptive_id,
      name,
      default_active,
      description,
      backend,
      cluster,
      auth,
      indexes,
      language,
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

const boolField = bool;

function optStr(e: Record<string, unknown>, key: string, i: number): string | undefined {
  const v = e[key];
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`connectors[${i}]: field "${key}" must be a non-empty string when set`);
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
