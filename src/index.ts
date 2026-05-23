import { loadBootConfig } from "./env.ts";
import { createApp } from "./server.ts";
import { bindDemoSession } from "./session-registry.ts";
import { initMcpConnectors } from "./mcp.ts";
import { initRagConnectors } from "./rag.ts";
import { initTrace } from "./trace.ts";
import { initStorageForDemo } from "./storage.ts";

const DEMO_SESSION_ID = "demo-session";

const config = loadBootConfig();

initTrace(config.trace_dir);

if (config.mode === "demo" && config.demo) {
  // Open hot SQLite for the demo (tenant, user) before the first
  // conversation/chat request — avoids first-request latency spike.
  initStorageForDemo();
  const session = bindDemoSession(DEMO_SESSION_ID, config.demo);
  const mcpConnectors = session.connectors.filter((c) => c.type === "mcp");
  const ragConnectors = session.connectors.filter((c) => c.type === "rag");
  if (mcpConnectors.length > 0) await initMcpConnectors(mcpConnectors);
  if (ragConnectors.length > 0) await initRagConnectors(ragConnectors);
}

const app = createApp(config);

// Boot banner — `mode` is also exposed via GET /healthz, which is the
// canonical signal an operator should gate production deploys on (per
// story 0009).
console.log(`augchatd up on :${config.port} (mode=${config.mode})`);
if (config.mode === "demo" && config.demo) {
  console.log("  demo: GET /demo/jwt enabled, mTLS bypassed, single-tenant");
  console.log(`  demo: ttl_seconds=${config.demo.ttl_seconds}`);
  console.log(`  demo: model=${config.demo.model.provider}/${config.demo.model.model_id}`);
  console.log(
    `  demo: cold storage=${config.demo.s3_uri ? "S3 configured" : "hot-only"}`,
  );
}
if (config.trace_dir) {
  console.log(`  trace: appending per-conversation JSONL to ${config.trace_dir}`);
}

export default {
  port: config.port,
  fetch: app.fetch,
};
