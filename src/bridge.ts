import * as http from "node:http";
import { z } from "zod";
import { pushEvent, type MailEvent } from "./event-queue.js";
import { enrichEvent } from "./ai/enrich.js";

// The bridge binds to 127.0.0.1 only, so it is unreachable from the network.
// Loopback binding is NOT sufficient on its own, though: a web page in the
// user's browser can POST cross-origin to 127.0.0.1, and DNS-rebinding can
// forge the Host header. So every request must also clear these checks before
// its body is parsed:
//   - reject anything carrying an `Origin` header (a browser always sends one;
//     the MailKit extension never does) — kills the drive-by-web-page vector;
//   - require `Content-Type: application/json` — blocks the CORS "simple
//     request" bypass that lets a page POST without a preflight;
//   - require a loopback `Host` — blocks DNS-rebinding;
//   - cap the body so a local process can't exhaust memory before parsing.
// (A shared-secret token, provisioned via an App Group so the sandboxed
// extension can read it, is the planned next step to also authenticate
// same-machine local processes.)

const MAX_BODY_BYTES = 64 * 1024;

/** True if the Host header names a loopback address (optionally with a port). */
function isLoopbackHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const declaredPort = host.match(/:(\d+)$/)?.[1];
  if (declaredPort && Number(declaredPort) !== port) return false;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

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
      // Reject browser-originated and rebound requests before reading any body.
      if (req.headers["origin"] !== undefined) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        res.writeHead(415).end("Unsupported Media Type");
        return;
      }
      if (!isLoopbackHost(req.headers["host"], port)) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      const chunks: Buffer[] = [];
      let received = 0;
      req.on("data", (c: Buffer) => {
        received += c.length;
        if (received > MAX_BODY_BYTES) {
          res.writeHead(413).end("Payload Too Large");
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("error", (err: Error) => {
        console.error("[apple-mail] Bridge request error:", err.message);
        if (!res.headersSent) res.writeHead(400).end("Bad Request");
      });
      req.on("end", () => {
        if (res.headersSent) return; // already rejected (e.g. oversized body)
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
