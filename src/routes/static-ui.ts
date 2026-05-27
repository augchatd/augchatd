import type { Context, Next } from "hono";
import { serveStatic } from "hono/bun";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const UI_DIST = resolve(import.meta.dir, "..", "..", "ui", "dist");
const UI_INDEX = join(UI_DIST, "index.html");

/**
 * Mount static-asset serving for the bundled UI.
 *
 * Per adr-0001-single-binary-bundled-ui + adr-0009-react-vite-bundled-ui:
 * the UI is a Vite-built React SPA, output as static HTML/CSS/JS, served
 * on `/` and `/assets/*` by the same Hono process that serves the JSON
 * API. SPA fallback: any non-matched non-API path renders index.html so
 * client-side routing works.
 *
 * If `ui/dist` is missing (developer never ran `bun run build:ui`),
 * `/` returns a clear hint instead of an opaque 404.
 */
export function mountStaticUi(
  app: import("hono").Hono,
  apiPathPredicate: (path: string) => boolean,
): void {
  if (!existsSync(UI_INDEX)) {
    app.get("/", (c) =>
      c.text(
        "augchatd: bundled UI is not built.\n" +
          "Run `bun run build:ui` (or `bun run dev:ui` in another terminal).\n",
        503,
      ),
    );
    return;
  }

  app.use(
    "/*",
    serveStatic({ root: "./ui/dist" }),
  );

  app.get("*", async (c: Context, next: Next) => {
    if (apiPathPredicate(c.req.path)) return next();
    return c.html(await Bun.file(UI_INDEX).text());
  });
}
