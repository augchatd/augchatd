import { mkdirSync, readFileSync } from "node:fs";
import { parseConnectors, type Connector } from "./connectors.ts";

export type AugchatdMode = "demo" | "prod";

export type UiTheme = "light" | "dark";

/**
 * Resolved demo-mode config. In demo, all per-session fields (model, prompt,
 * storage, connectors, theme) come from a JSON file on disk that mirrors the
 * shape of the production `POST /sessions` body — so the local config is a
 * literal preview of what an integrator would send over HTTP. See
 * [contract-demo-mode](../spec/src/behavior/contracts/demo-mode.md) and
 * [contract-session-create](../spec/src/behavior/contracts/session-create.md).
 *
 * `ttl_seconds` is the only field that stays an env var: JWT lifetime is a
 * server-deployment concern, not a per-session payload concern.
 *
 * `storage` is held opaquely until contract-storage-flush lands and parses it;
 * boot only checks presence (object) vs absence (hot-only).
 */
export interface DemoModeConfig {
  user_id: string;
  model: { provider: string; model_id: string; api_key: string };
  system_prompt: string;
  storage: Record<string, unknown> | undefined;
  connectors: Connector[];
  ttl_seconds: number;
  theme: UiTheme;
}

export interface BootConfig {
  mode: AugchatdMode;
  port: number;
  demo: DemoModeConfig | undefined;
  /**
   * Directory where per-conversation JSONL traces are appended. Unset =
   * tracing disabled (no overhead). Mode-agnostic: works in demo and
   * prod. Read from AUGCHATD_TRACE_DIR; the directory is created at
   * boot if absent.
   */
  trace_dir: string | undefined;
}

const DEFAULT_PORT = 8080;
const DEFAULT_DEMO_TTL_SECONDS = 60;
const DEFAULT_DEMO_SESSION_FILE = "local/demo_session.json";

export function loadBootConfig(): BootConfig {
  const mode = readMode();
  return {
    mode,
    port: readPort(),
    demo: mode === "demo" ? readDemoConfig() : undefined,
    trace_dir: readTraceDir(),
  };
}

function readMode(): AugchatdMode {
  return process.env.AUGCHATD_MODE?.toLowerCase() === "demo" ? "demo" : "prod";
}

function readPort(): number {
  const raw = process.env.AUGCHATD_PORT ?? process.env.PORT;
  if (!raw) return DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return n;
}

function readTraceDir(): string | undefined {
  const raw = process.env.AUGCHATD_TRACE_DIR;
  if (!raw) return undefined;
  try {
    mkdirSync(raw, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`AUGCHATD_TRACE_DIR could not be created at '${raw}': ${msg}`);
  }
  return raw;
}

function readDemoConfig(): DemoModeConfig {
  const path = process.env.DEMO_SESSION_FILE ?? DEFAULT_DEMO_SESSION_FILE;
  const text = readSessionFile(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`${path}: not valid JSON (${(e as Error).message})`);
  }
  return validateSession(parsed, path);
}

function readSessionFile(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(missingSessionFileMessage(path));
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`demo session config at ${path} could not be read: ${msg}`);
  }
}

function missingSessionFileMessage(path: string): string {
  const template = `${DEFAULT_DEMO_SESSION_FILE}.example`;
  return [
    ``,
    `Demo session config not found at ${path}.`,
    ``,
    `A template is committed at ${template}. Copy it:`,
    ``,
    `    cp ${template} ${path}`,
    ``,
    `Then edit ${path} and fill in your model API key, S3 credentials,`,
    `and connector list. See README → "Local development" for a field-by-field`,
    `walkthrough; the file shape mirrors the production POST /sessions body.`,
    ``,
  ].join("\n");
}

function validateSession(value: unknown, path: string): DemoModeConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}: must be a JSON object`);
  }
  const o = value as Record<string, unknown>;

  const user_id = reqString(o, "user_id", path);
  const system_prompt = reqString(o, "system_prompt", path);
  const model = reqModel(o["model"], path);
  const connectors = parseConnectors(o["connectors"]);
  const storage = optObject(o["storage"], "storage", path);
  const theme = readTheme(o["theme"], path);

  return {
    user_id,
    model,
    system_prompt,
    storage,
    connectors,
    ttl_seconds: readDemoTtl(),
    theme,
  };
}

function reqString(o: Record<string, unknown>, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`${path}: field "${key}" must be a non-empty string`);
  }
  return v;
}

function reqModel(value: unknown, path: string): DemoModeConfig["model"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}: field "model" must be an object`);
  }
  const m = value as Record<string, unknown>;
  return {
    provider: reqString(m, "provider", `${path}.model`),
    model_id: reqString(m, "model_id", `${path}.model`),
    api_key: reqString(m, "api_key", `${path}.model`),
  };
}

function optObject(
  value: unknown,
  key: string,
  path: string,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}: field "${key}" must be an object when set`);
  }
  return value as Record<string, unknown>;
}

function readTheme(value: unknown, path: string): UiTheme {
  if (value === undefined) return "light";
  if (value === "light" || value === "dark") return value;
  throw new Error(`${path}: field "theme" must be "light" or "dark" (got ${JSON.stringify(value)})`);
}

function readDemoTtl(): number {
  const raw = process.env.DEMO_TTL_SECONDS;
  if (!raw) return DEFAULT_DEMO_TTL_SECONDS;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_DEMO_TTL_SECONDS;
  return n;
}
