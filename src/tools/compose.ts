import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runScript, parseMessageRef, textContent } from "../applescript-runner.js";

export function registerComposeTools(server: McpServer): void {
  server.tool(
    "compose_email",
    "Compose a new email. If send is false (default), opens the compose window with a draft. " +
      "If send is true, sends immediately without confirmation.",
    {
      to: z.string().describe("Recipient email address."),
      subject: z.string().describe("Email subject line."),
      body: z.string().describe("Email body text."),
      cc: z.string().optional().describe("CC recipient email address (optional)."),
      send: z
        .boolean()
        .default(false)
        .describe("If true, send immediately. If false (default), open compose window with draft."),
    },
    async ({ to, subject, body, cc, send }) => {
      const raw = await runScript("compose", [to, subject, body, cc ?? "", send ? "true" : "false"]);
      return textContent(raw);
    }
  );

  server.tool(
    "reply_email",
    "Reply to an existing email. If send is false (default), opens the reply in a compose window. " +
      "If send is true, sends immediately without confirmation.",
    {
      message_ref: z
        .string()
        .describe('Composite message reference from list_emails or search_emails, e.g. "iCloud::INBOX::msg-id".'),
      body: z.string().describe("Reply body text."),
      send: z
        .boolean()
        .default(false)
        .describe("If true, send immediately. If false (default), open compose window with reply draft."),
    },
    async ({ message_ref, body, send }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const raw = await runScript("reply", [account, mailbox, messageId, body, send ? "true" : "false"]);
      return textContent(raw);
    }
  );
}
