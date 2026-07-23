import type { Express } from "express";
import { requireAuth } from "../auth";
import { eventsBus, type LiveEvent } from "../services/events";

export function registerStreamRoutes(app: Express) {
  app.get("/api/events", requireAuth, (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");

    const onBatch = (batch: LiveEvent[]) => {
      res.write(`data: ${JSON.stringify(batch)}\n\n`);
    };
    eventsBus.on("batch", onBatch);

    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      eventsBus.off("batch", onBatch);
    });
  });
}
