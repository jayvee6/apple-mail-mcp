# apple-mail-mcp

**The only way to give Claude (or any LLM) access to Apple Mail and iCloud.**

Gmail and Outlook have APIs. iCloud doesn't. If you're a Mac user whose email lives in Apple Mail — iCloud, iCloud+, or any account synced through it — there's no web API an LLM can call. This server bridges that gap using AppleScript on your local machine.

It gives Claude full control over Apple Mail: read, search, compose, reply, move, flag, and delete messages using natural language, against your real inbox, with no cloud intermediary.

Built on [AppleScript](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/) via `osascript`, with an optional MailKit extension for real-time new-mail events.

---

## Tools

| Tool | Description |
|------|-------------|
| `list_folders` | List all accounts and their mailboxes |
| `list_emails` | Paginate messages in a mailbox (newest-first) |
| `get_email` | Read a message's full headers and body |
| `search_emails` | Filter by sender, subject, date range across mailboxes |
| `compose_email` | Create a draft or send a new message immediately |
| `reply_email` | Reply to a message, open as draft or send immediately |
| `move_email` | Move a message to any mailbox |
| `archive_email` | Move to Archive (iCloud) or All Mail (Gmail) |
| `move_to_junk` | Move to Junk (iCloud) or Spam (Gmail) |
| `flag_email` | Set or clear the flag on a message |
| `mark_read` | Mark a message as read or unread |
| `delete_email` | Move to Deleted Messages (iCloud) or Trash (Gmail) |
| `get_pending_events` | Drain real-time new-mail events from the MailKit bridge |

---

## Requirements

- **macOS** (tested on Sonoma / Sequoia)
- **Apple Mail** open and configured with at least one account
- **Node.js 18+**

---

## Installation

### One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/jayvee6/apple-mail-mcp/master/install.sh | bash
```

The script clones the repo to `~/apple-mail-mcp`, builds it, and automatically patches `~/Library/Application Support/Claude/claude_desktop_config.json`. Then restart Claude Desktop.

### Manual

```bash
git clone https://github.com/jayvee6/apple-mail-mcp.git
cd apple-mail-mcp
npm install && npm run build
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apple-mail": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/path/to/apple-mail-mcp/dist/index.js"]
    }
  }
}
```

Use `which node` to get the full path to your Node binary. Restart Claude Desktop, then ask: *"What folders do I have in my mail?"*

### Automation Permission

The first time you use a mail tool, macOS will ask whether to allow `node` to control Mail. Click **Allow**. If you accidentally deny it, go to **System Settings → Privacy & Security → Automation** and re-enable it for your terminal or Node.js runtime.

---

## How It Works

```
Claude ──stdio──▶ MCP server (Node.js)
                      │
                      ├── runScript("list_messages", [...args])
                      │        │
                      │        └── osascript scripts/applescript/list_messages.applescript
                      │                 │
                      │                 └── Apple Mail (AppleScript dictionary)
                      │
                      └── HTTP bridge  ◀── MailKit extension (optional)
                          localhost:27182
```

**Message references** are composite keys that uniquely identify a message without a fragile integer index:

```
{account}::{mailbox}::{RFC 2822 Message-ID}

e.g.  iCloud::INBOX::<CABx3f...@mail.gmail.com>
```

Every list/search result includes a `message_ref`. Tools that operate on individual messages (`get_email`, `reply_email`, `move_email`, etc.) take this ref as input. The account and mailbox components scope the AppleScript lookup to the right mailbox; the RFC 2822 ID is the stable identifier. Mail's `whose` predicate makes the per-message lookup O(1).

---

## MailKit Bridge (optional)

The `MailKitBridge/` directory contains an Xcode project for a Mail extension that fires a local HTTP POST to `localhost:27182/event` when new messages arrive. This populates `get_pending_events` in real time rather than requiring a manual poll.

The MCP server starts the HTTP listener on startup regardless — it's a no-op if the extension isn't installed.

To build and install the extension: open `MailKitBridge/MailKitBridge.xcodeproj` in Xcode, build the **MailKitBridgeApp** scheme, run the app once to register the extension, then enable it in **Mail → Settings → Extensions**.

---

## Development

```bash
npm run dev          # run with tsx (no build step)
npm run build        # compile TypeScript → dist/
npm run typecheck    # type-check without emitting
```

AppleScript files live in `scripts/applescript/` and are invoked directly via `osascript` — no compilation needed. You can test them standalone:

```bash
osascript scripts/applescript/list_folders.applescript
osascript scripts/applescript/list_messages.applescript "iCloud" "INBOX" "1" "5"
```

---

## Security Notes

- The HTTP bridge binds to `127.0.0.1` only — not reachable from outside the machine.
- Script names are validated against `path.basename()` before use to prevent path traversal.
- Arguments are passed to `osascript` via `execFile` (not a shell), so there is no shell-injection surface.
- AppleScript calls time out after 30 seconds to prevent hangs if Mail is frozen or showing a permission prompt.

---

## License

MIT
