import { loadBootConfig } from "./env.ts";
import { createApp } from "./server.ts";
import { bindDemoSession } from "./session-registry.ts";

const DEMO_SESSION_ID = "demo-session";

const config = loadBootConfig();

if (config.mode === "demo" && config.demo) {
  bindDemoSession(DEMO_SESSION_ID, config.demo);
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
    `  demo: connectors=${config.demo.connectors_raw ? "configured (not yet parsed in this scaffold)" : "none"}`,
  );
  console.log(
    `  demo: cold storage=${config.demo.s3_uri ? "S3 configured" : "hot-only"}`,
  );
}

export default {
  port: config.port,
  fetch: app.fetch,
};
