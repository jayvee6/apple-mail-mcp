import * as http from "node:http";
import { pushEvent, type MailEvent } from "./event-queue.js";

export function startBridge(port = 27182): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/event") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          pushEvent(JSON.parse(body) as MailEvent);
          res.writeHead(200).end("OK");
        } catch {
          res.writeHead(400).end("Bad Request");
        }
      });
    } else {
      res.writeHead(404).end();
    }
  });

  server.listen(port, "127.0.0.1", () =>
    console.error(`[apple-mail] Bridge listening on 127.0.0.1:${port}`)
  );

  return server;
}
