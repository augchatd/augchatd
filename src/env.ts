import { mkdirSync, readFileSync } from "node:fs";

export type AugchatdMode = "demo" | "prod";

export type UiTheme = "light" | "dark";

export interface DemoModeConfig {
  model: {
    provider: string;
    model_id: string;
    api_key: string;
  };
  system_prompt: string;
  s3_uri: string | undefined;
  /**
   * Raw JSON text of the connectors[] array (from DEMO_CONNECTORS or the
   * contents of DEMO_CONNECTORS_FILE). Not parsed here — the connector
   * dispatcher (forthcoming) owns the schema. Boot only verifies that
   * exactly one source is set.
   */
  connectors_raw: string | undefined;
  ttl_seconds: number;
  /**
   * UI color scheme served by the bundled UI. Default `"light"`. Set via
   * `DEMO_THEME`. Surfaced to the browser via the `/demo/jwt` response.
   * (In production this will be a per-session field on `POST /sessions`.)
   */
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

export function loadBootConfig(): BootConfig {
  const mode = readMode();
  return {
    mode,
    port: readPort(),
    demo: mode === "demo" ? readDemoConfig() : undefined,
    trace_dir: readTraceDir(),
  };
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

function readMode(): AugchatdMode {
  const v = process.env.AUGCHATD_MODE?.toLowerCase();
  return v === "demo" ? "demo" : "prod";
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

function readDemoConfig(): DemoModeConfig {
  const provider = req("DEMO_MODEL_PROVIDER");
  const model_id = req("DEMO_MODEL_ID");
  const api_key = req("DEMO_MODEL_API_KEY");
  const system_prompt = req("DEMO_SYSTEM_PROMPT");

  const connectorsEnv = process.env.DEMO_CONNECTORS;
  const connectorsFile = process.env.DEMO_CONNECTORS_FILE;

  // Per contract-demo-mode: both set is a boot failure (no precedence).
  if (connectorsEnv && connectorsFile) {
    throw new Error(
      "DEMO_CONNECTORS and DEMO_CONNECTORS_FILE are both set. " +
        "Choose one.",
    );
  }

  let connectors_raw: string | undefined;
  if (connectorsEnv) {
    connectors_raw = connectorsEnv;
    validateJson(connectors_raw, "DEMO_CONNECTORS");
  } else if (connectorsFile) {
    // contract-demo-mode: file is read exactly once at boot.
    connectors_raw = readFileText(connectorsFile);
    validateJson(connectors_raw, "DEMO_CONNECTORS_FILE");
  }

  return {
    model: { provider, model_id, api_key },
    system_prompt,
    s3_uri: process.env.DEMO_S3_URI,
    connectors_raw,
    ttl_seconds: readDemoTtl(),
    theme: readDemoTheme(),
  };
}

function readDemoTheme(): UiTheme {
  const raw = process.env.DEMO_THEME?.toLowerCase();
  if (!raw) return "light";
  if (raw === "light" || raw === "dark") return raw;
  throw new Error(
    `DEMO_THEME must be "light" or "dark" (got '${raw}')`,
  );
}

function readDemoTtl(): number {
  const raw = process.env.DEMO_TTL_SECONDS;
  if (!raw) return DEFAULT_DEMO_TTL_SECONDS;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_DEMO_TTL_SECONDS;
  return n;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function readFileText(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DEMO_CONNECTORS_FILE could not be read at '${path}': ${msg}`);
  }
}

function validateJson(text: string, source: string): void {
  try {
    JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${source} is not valid JSON: ${msg}`);
  }
}
