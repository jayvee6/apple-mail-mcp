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
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
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
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
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
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
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
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
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
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
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
      let ref;
      try {
        ref = parseMessageRef(message_ref);
      } catch (err) {
        return textContent(`ERROR: Invalid message_ref — ${(err as Error).message}`);
      }
      const { account, mailbox, messageId } = ref;
      const trashName = trashMailboxForAccount(account);
      const raw = await runScript("delete", [account, mailbox, messageId, trashName]);
      return textContent(raw);
    }
  );

  server.tool(
    "create_folder",
    "Create a new top-level mailbox/folder inside an account. Idempotent — reports success if the folder already exists. " +
      "Pair with move_matching to file mail by rule.",
    {
      account: z.string().describe('Account to create the folder in, e.g. "iCloud". Use list_folders to see accounts.'),
      name: z.string().describe('Name of the new folder, e.g. "Newsletters".'),
    },
    async ({ account, name }) => {
      const raw = await runScript("create_mailbox", [account, name]);
      return textContent(raw);
    }
  );

  server.tool(
    "move_matching",
    "Bulk-move every email in a source mailbox that matches the given criteria into a destination mailbox, in one pass. " +
      "Each call matches a single from/subject substring; to file a sender that spans several unrelated addresses, " +
      "issue one call per address into the same folder. " +
      "At least one filter (from_filter, subject_filter, after_date, before_date) is required — this guards against " +
      "accidentally moving an entire mailbox. The destination must already exist (call create_folder first if needed). " +
      "Omit limit to move ALL matches (fast native bulk move); set limit to cap the count (slower, per-message). " +
      "Returns the number of messages moved. On very large mailboxes this can take a few minutes.",
    {
      src_account: z.string().describe('Source account to scan, e.g. "iCloud".'),
      src_mailbox: z.string().default("INBOX").describe('Source mailbox to scan. Defaults to "INBOX".'),
      dest_account: z.string().describe('Destination account, e.g. "iCloud".'),
      dest_mailbox: z
        .string()
        .describe("Destination mailbox name. Must already exist — call create_folder first if needed."),
      from_filter: z
        .string()
        .optional()
        .describe(
          'Substring match on the sender — display name OR address, case-insensitive. E.g. "crypto.com" matches ' +
            'both "news.crypto.com" addresses and a "Crypto.com" display name. A sender using several unrelated ' +
            "addresses with no shared substring needs one call per address into the same folder."
        ),
      subject_filter: z.string().optional().describe("Substring match on subject line."),
      after_date: z.string().optional().describe('Only move messages received after this date. ISO 8601: "YYYY-MM-DD".'),
      before_date: z.string().optional().describe('Only move messages received before this date. ISO 8601: "YYYY-MM-DD".'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .optional()
        .describe(
          "Optional cap on how many messages to move. Omit to move ALL matches (fast native bulk move); " +
            "set to move at most N (slower, per-message)."
        ),
    },
    async ({ src_account, src_mailbox, dest_account, dest_mailbox, from_filter, subject_filter, after_date, before_date, limit }) => {
      // Safety: require at least one MEANINGFUL filter so an empty (or whitespace-only)
      // call can never bulk-move a whole mailbox. A lone space in from_filter would
      // otherwise pass a truthiness check yet match `sender contains " "` — i.e.
      // nearly every message. Require a filter with real, non-trivial content.
      const from = from_filter?.trim() ?? "";
      const subject = subject_filter?.trim() ?? "";
      const after = after_date?.trim() ?? "";
      const before = before_date?.trim() ?? "";
      if (from.length < 2 && subject.length < 2 && !after && !before) {
        return textContent(
          "ERROR: Provide at least one substantive filter — from_filter or subject_filter " +
            "must be at least 2 non-whitespace characters, or supply after_date / before_date. " +
            "This guards against accidentally moving an entire mailbox."
        );
      }
      const raw = await runScript(
        "move_matching",
        [
          src_account,
          src_mailbox,
          from,
          subject,
          after,
          before,
          dest_account,
          dest_mailbox,
          String(limit ?? 0),
        ],
        // Large mailboxes: the whose-scan over 30k+ messages (and, in the capped
        // path, per-message moves) can take minutes, well past the default 30s.
        { timeoutMs: 600_000 }
      );
      return textContent(raw);
    }
  );
}
