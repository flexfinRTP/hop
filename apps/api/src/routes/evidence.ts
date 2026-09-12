import { Hono } from "hono";
import { getById } from "../store.js";

export const evidence = new Hono();

evidence.get("/:id", (c) => {
  const row = getById(c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row.json);
});
