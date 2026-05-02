import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runScript, buildMessageRef, textContent } from "../applescript-runner.js";

interface SearchResult {
  message_ref: string;
  account: string;
  mailbox: string;
  subject: string;
  from: string;
  date: string;
  read: boolean;
}

function parseSearchResults(raw: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const line of raw.split("\n")) {
    const parts = line.split("\t");
    // messageId TAB account TAB mailbox TAB subject TAB sender TAB dateReceived TAB isRead
    if (parts.length < 7) continue;
    const [messageId, account, mailbox, subject, from, date, readStr] = parts;
    results.push({
      message_ref: buildMessageRef(account, mailbox, messageId),
      account,
      mailbox,
      subject,
      from,
      date,
      read: readStr === "true",
    });
  }
  return results;
}

export function registerSearchTools(server: McpServer): void {
  server.tool(
    "search_emails",
    "Search for emails matching criteria across one or all mailboxes. " +
      "Returns message summaries with message_ref fields for use with other tools. " +
      "At least one filter (from_filter, subject_filter, after_date, before_date) should be provided.",
    {
      account: z
        .string()
        .optional()
        .describe('Account to search, e.g. "iCloud". Use "ALL" to search all accounts. Defaults to "ALL".'),
      mailbox: z
        .string()
        .optional()
        .describe('Mailbox to search, e.g. "INBOX". Use "ALL" to search all mailboxes in the account. Defaults to "INBOX".'),
      from_filter: z.string().optional().describe("Substring match on sender name or address."),
      subject_filter: z.string().optional().describe("Substring match on subject line."),
      after_date: z
        .string()
        .optional()
        .describe('Only return messages received after this date. ISO 8601 format: "YYYY-MM-DD".'),
      before_date: z
        .string()
        .optional()
        .describe('Only return messages received before this date. ISO 8601 format: "YYYY-MM-DD".'),
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of results (max 100)."),
    },
    async ({ account, mailbox, from_filter, subject_filter, after_date, before_date, limit }) => {
      const raw = await runScript("search", [
        account ?? "ALL",
        mailbox ?? "INBOX",
        from_filter ?? "",
        subject_filter ?? "",
        after_date ?? "",
        before_date ?? "",
        String(limit),
      ]);
      if (!raw) return textContent(JSON.stringify([]));
      const results = parseSearchResults(raw);
      return textContent(JSON.stringify(results, null, 2));
    }
  );
}
