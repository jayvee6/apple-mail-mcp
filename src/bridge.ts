import * as http from "node:http";
import { z } from "zod";
import { pushEvent, type MailEvent } from "./event-queue.js";
import { enrichEvent } from "./ai/enrich.js";

// The bridge only binds to 127.0.0.1 — no external access is possible.
// Bearer-token auth is omitted because the sandboxed MailKit extension
// cannot read ~/.apple-mail-mcp.secret (outside its container), and
// localhost-only binding already limits who can POST here.

const MailEventSchema = z.object({
  subject: z.string(),
  from: z.string(),
  date: z.string(),
  messageId: z.string(),
  preview: z.string(),
  receivedAt: z.string().optional(),
  encryptionState: z.string().optional(),
});

export function startBridge(port = 27182): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/event") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("error", (err: Error) => {
        console.error("[apple-mail] Bridge request error:", err.message);
        res.writeHead(400).end("Bad Request");
      });
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          const parsed = MailEventSchema.safeParse(JSON.parse(body));
          if (!parsed.success) {
            res.writeHead(400).end("Bad Request");
            return;
          }
          // Respond immediately — the MailKit extension is fire-and-forget.
          res.writeHead(200).end("OK");
          console.error("[apple-mail] Event received");
          // Enrich with AI in the background, then push to the queue.
          enrichEvent(parsed.data as MailEvent).then(pushEvent).catch(() => {
            pushEvent(parsed.data as MailEvent);
          });
        } catch (err) {
          console.error("[apple-mail] Bridge parse error:", err instanceof Error ? (err as Error).message : String(err));
          res.writeHead(400).end("Bad Request");
        }
      });
    } else {
      res.writeHead(404).end();
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[apple-mail] Bridge port ${port} already in use — skipping MailKit event bridge.`);
    } else {
      console.error("[apple-mail] Bridge error:", err.message);
    }
  });

  server.listen(port, "127.0.0.1", () =>
    console.error(`[apple-mail] Bridge listening on 127.0.0.1:${port}`)
  );

  return server;
}
