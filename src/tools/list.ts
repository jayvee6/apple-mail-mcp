import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runScript, buildMessageRef } from "../applescript-runner.js";

interface FolderEntry {
  account: string;
  mailbox: string;
}

interface FolderTree {
  [account: string]: string[];
}

interface EmailSummary {
  message_ref: string;
  subject: string;
  from: string;
  date: string;
  read: boolean;
}

function parseFolders(raw: string): FolderTree {
  const tree: FolderTree = {};
  for (const line of raw.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const [account, mailbox] = parts;
    if (!tree[account]) tree[account] = [];
    tree[account].push(mailbox);
  }
  return tree;
}

function parseMessages(raw: string, account: string, mailbox: string): EmailSummary[] {
  const results: EmailSummary[] = [];
  for (const line of raw.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 5) continue;
    const [messageId, subject, from, date, readStr] = parts;
    results.push({
      message_ref: buildMessageRef(account, mailbox, messageId),
      subject,
      from,
      date,
      read: readStr === "true",
    });
  }
  return results;
}

export function registerListTools(server: McpServer): void {
  server.tool(
    "list_folders",
    "List all mail accounts and their folders/mailboxes. Returns a tree of account → [mailbox names]. " +
      "Use this to discover exact mailbox names before calling list_emails or search_emails.",
    {},
    async () => {
      const raw = await runScript("list_folders", []);
      const tree = parseFolders(raw);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tree, null, 2) }],
      };
    }
  );

  server.tool(
    "list_emails",
    "List emails in a specific mailbox with pagination. Returns message summaries including a message_ref " +
      "that can be passed to get_email, reply_email, move_email, etc. " +
      "Messages are returned newest-first (index 1 = most recent).",
    {
      account: z.string().describe('Account name, e.g. "iCloud" or "Google". Use list_folders to see available accounts.'),
      mailbox: z.string().describe('Mailbox name, e.g. "INBOX", "Sent Messages". Must match exactly (case-sensitive).'),
      offset: z.number().int().min(1).default(1).describe("1-based offset for pagination. Start with 1."),
      limit: z.number().int().min(1).max(100).default(20).describe("Number of messages to return (max 100)."),
    },
    async ({ account, mailbox, offset, limit }) => {
      const raw = await runScript("list_messages", [account, mailbox, String(offset), String(limit)]);
      if (!raw) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify([]) }],
        };
      }
      const messages = parseMessages(raw, account, mailbox);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(messages, null, 2) }],
      };
    }
  );
}
