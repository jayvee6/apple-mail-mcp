import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { drainEvents } from "../event-queue.js";
import { untrustedContent } from "../applescript-runner.js";

export function registerEventTools(server: McpServer): void {
  server.tool(
    "get_pending_events",
    "Return and clear all real-time incoming mail events pushed by the MailKit extension. " +
      "Returns an empty array if the extension is not installed or no new mail has arrived since the last call. " +
      "Each event includes: subject, from, date, messageId, preview, receivedAt.",
    {},
    async () => {
      const events = drainEvents();
      return untrustedContent(
        JSON.stringify(events, null, 2),
        "Real-time incoming mail events; subject/from/preview are attacker-controlled."
      );
    }
  );
}
