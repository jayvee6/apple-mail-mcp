import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runScript, parseMessageRef, textContent } from "../applescript-runner.js";

// Per-provider special-mailbox names. Fallbacks cover unknown providers.
const TRASH_MAILBOX: Record<string, string> = {
  iCloud: "Deleted Messages",
  Google: "Trash",
};
const ARCHIVE_MAILBOX: Record<string, string> = {
  iCloud: "Archive",
  Google: "All Mail",
};
const JUNK_MAILBOX: Record<string, string> = {
  iCloud: "Junk",
  Google: "Spam",
};

function trashMailboxForAccount(account: string): string {
  return TRASH_MAILBOX[account] ?? "Deleted Messages";
}
function archiveMailboxForAccount(account: string): string {
  return ARCHIVE_MAILBOX[account] ?? "Archive";
}
function junkMailboxForAccount(account: string): string {
  return JUNK_MAILBOX[account] ?? "Junk";
}

export function registerOrganizeTools(server: McpServer): void {
  server.tool(
    "move_email",
    "Move an email to a different mailbox. Use list_folders to see available mailbox names.",
    {
      message_ref: z.string().describe("Composite message reference from list_emails or search_emails."),
      dest_account: z.string().describe('Destination account name, e.g. "iCloud".'),
      dest_mailbox: z
        .string()
        .describe('Destination mailbox name, e.g. "Finance & Accounts". Must match exactly (case-sensitive).'),
    },
    async ({ message_ref, dest_account, dest_mailbox }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const raw = await runScript("move", [account, mailbox, messageId, dest_account, dest_mailbox]);
      return textContent(raw);
    }
  );

  server.tool(
    "archive_email",
    "Move an email to the Archive mailbox of its account. Uses 'Archive' for iCloud, 'All Mail' for Gmail.",
    {
      message_ref: z.string().describe("Composite message reference from list_emails or search_emails."),
    },
    async ({ message_ref }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const archiveName = archiveMailboxForAccount(account);
      const raw = await runScript("move", [account, mailbox, messageId, account, archiveName]);
      return textContent(raw);
    }
  );

  server.tool(
    "flag_email",
    "Set or clear the flag on an email.",
    {
      message_ref: z.string().describe("Composite message reference from list_emails or search_emails."),
      flagged: z.boolean().describe("True to flag the message, false to unflag it."),
    },
    async ({ message_ref, flagged }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const raw = await runScript("flag", [account, mailbox, messageId, flagged ? "true" : "false"]);
      return textContent(raw);
    }
  );

  server.tool(
    "mark_read",
    "Mark an email as read or unread.",
    {
      message_ref: z.string().describe("Composite message reference from list_emails or search_emails."),
      read: z.boolean().describe("True to mark as read, false to mark as unread."),
    },
    async ({ message_ref, read }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const raw = await runScript("mark_read", [account, mailbox, messageId, read ? "true" : "false"]);
      return textContent(raw);
    }
  );

  server.tool(
    "move_to_junk",
    "Move an email to the Junk/Spam mailbox of its account. Uses 'Junk' for iCloud, 'Spam' for Gmail.",
    {
      message_ref: z.string().describe("Composite message reference from list_emails or search_emails."),
    },
    async ({ message_ref }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const junkName = junkMailboxForAccount(account);
      const raw = await runScript("move", [account, mailbox, messageId, account, junkName]);
      return textContent(raw);
    }
  );

  server.tool(
    "delete_email",
    "Move an email to the Trash (Deleted Messages for iCloud, Trash for Gmail).",
    {
      message_ref: z.string().describe("Composite message reference from list_emails or search_emails."),
    },
    async ({ message_ref }) => {
      const { account, mailbox, messageId } = parseMessageRef(message_ref);
      const trashName = trashMailboxForAccount(account);
      const raw = await runScript("delete", [account, mailbox, messageId, trashName]);
      return textContent(raw);
    }
  );
}
