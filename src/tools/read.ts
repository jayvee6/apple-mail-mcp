import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runScript, parseMessageRef, textContent, untrustedContent } from "../applescript-runner.js";

export function registerReadTools(server: McpServer): void {
  server.tool(
    "get_email",
    "Read the full content of a specific email including headers and body. " +
      "The message_ref comes from list_emails or search_emails results.",
    {
      message_ref: z
        .string()
        .describe(
          'Composite message reference in format "account::mailbox::rfc2822-id". ' +
            "Obtained from list_emails or search_emails results."
        ),
    },
    async ({ message_ref }) => {
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
      const raw = await runScript("get_message", [account, mailbox, messageId]);
      return untrustedContent(raw, "Full content of the requested email.");
    }
  );
}
