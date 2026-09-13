import { serve } from "@hono/node-server";
import { closeDatabase } from "./database.js";
import { app, cfg, stopHcsOutbox } from "./app.js";

export default app;

if (!process.env.VERCEL) {
  serve({ fetch: app.fetch, port: cfg.port }, () => {
    console.log(`HOP api :${cfg.port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stopHcsOutbox();
      void closeDatabase().finally(() => process.exit(0));
    });
  }
}
