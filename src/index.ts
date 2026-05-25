import { loadBootConfig } from "./env.ts";
import { createApp } from "./server.ts";
import { initMcpConnectors } from "./mcp.ts";
import { initRagConnectors } from "./rag.ts";
import { initTrace } from "./trace.ts";
import { initStorageForDemo } from "./storage.ts";

const config = loadBootConfig();

initTrace(config.trace_dir);

if (config.mode === "demo" && config.demo) {
  // Open hot SQLite for the demo (tenant, user) before the first
  // conversation/chat request — avoids first-request latency spike.
  initStorageForDemo(config.demo.user_id);
  // MCP and RAG clients are expensive (handshake, persistent connection)
  // — initialize them once at boot. Each POST /demo/sessions mints a
  // SessionRecord with its own connector array, but the clients are
  // shared via the module-level registry in mcp.ts / rag.ts (keyed by
  // descriptive_id).
  const mcpConnectors = config.demo.connectors.filter((c) => c.type === "mcp");
  const ragConnectors = config.demo.connectors.filter((c) => c.type === "rag");
  if (mcpConnectors.length > 0) await initMcpConnectors(mcpConnectors);
  if (ragConnectors.length > 0) await initRagConnectors(ragConnectors);
}

const app = createApp(config);

// Boot banner — `mode` is also exposed via GET /healthz, which is the
// canonical signal an operator should gate production deploys on (per
// story 0009).
console.log(`augchatd up on :${config.port} (mode=${config.mode})`);
if (config.mode === "demo" && config.demo) {
  console.log(`  demo: open http://localhost:${config.port}/demo/`);
  console.log(`  demo: ttl_seconds=${config.demo.ttl_seconds}`);
  console.log(`  demo: model=${config.demo.model.provider}/${config.demo.model.model_id}`);
  console.log(
    `  demo: cold storage=${config.demo.storage ? "configured" : "hot-only"}`,
  );
  console.log(`  demo: theme=${config.demo.theme}`);
}
if (config.trace_dir) {
  console.log(`  trace: appending per-conversation JSONL to ${config.trace_dir}`);
}

export default {
  port: config.port,
  fetch: app.fetch,
};
