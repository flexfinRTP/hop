import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getTrace, onTrace } from "../store.js";

export const events = new Hono();

events.get("/:id", (c) => {
  const id = c.req.param("id");
  return streamSSE(c, async (stream) => {
    for (const ev of getTrace(id)) {
      await stream.writeSSE({ data: JSON.stringify(ev) });
    }
    await new Promise<void>((resolve) => {
      const off = onTrace(id, (ev) => {
        void stream.writeSSE({ data: JSON.stringify(ev) });
      });
      stream.onAbort(() => {
        off();
        resolve();
      });
    });
  });
});
