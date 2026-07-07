# apple-mail-mcp

<p align="center">
  <img src="assets/icon.gif" alt="apple-mail-mcp animated icon" width="320" height="320">
</p>

**The only way to give Claude (or any LLM) access to Apple Mail and iCloud.**

Gmail and Outlook have APIs. iCloud doesn't. If you're a Mac user whose email lives in Apple Mail — iCloud, iCloud+, or any account synced through it — there's no web API an LLM can call. This server bridges that gap using AppleScript on your local machine.

It gives Claude full control over Apple Mail: read, search, compose, reply, move, flag, and delete messages using natural language, against your real inbox, with no cloud intermediary.

Built on [AppleScript](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/) via `osascript`, with an optional MailKit extension for real-time new-mail events.

---

## Tools

| Tool | Description |
|------|-------------|
| `list_folders` | List all accounts and their mailboxes |
| `create_folder` | Create a new mailbox/folder in an account (idempotent) |
| `list_emails` | Paginate messages in a mailbox (newest-first) |
| `get_email` | Read a message's full headers and body |
| `search_emails` | Filter by sender, subject, date range across mailboxes |
| `compose_email` | Create a draft or send a new message immediately |
| `reply_email` | Reply to a message, open as draft or send immediately |
| `move_email` | Move a message to any mailbox |
| `move_matching` | Bulk-move all messages matching a filter into a mailbox |
| `archive_email` | Move to Archive (iCloud) or All Mail (Gmail) |
| `move_to_junk` | Move to Junk (iCloud) or Spam (Gmail) |
| `flag_email` | Set or clear the flag on a message |
| `mark_read` | Mark a message as read or unread |
| `delete_email` | Move to Deleted Messages (iCloud) or Trash (Gmail) |
| `get_pending_events` | Drain real-time new-mail events from the MailKit bridge |
| `summarize_email` | Summarize a message in 2-3 sentences via local AI |
| `classify_email` | Classify by category, priority, and action-required via local AI |
| `draft_reply` | Draft a reply body via local AI (review before sending) |
| `triage_inbox` | Bulk-classify up to 20 messages, sorted by priority |

---

## Requirements

- **macOS** (tested on Sonoma / Sequoia / macOS 26)
- **Apple Mail** open and configured with at least one account
- **Node.js 18+**
- **LM Studio** (optional) — for local AI tools; any OpenAI-compatible server works

---

## Installation

### npx (recommended)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apple-mail": {
      "command": "npx",
      "args": ["-y", "@jdot6/apple-mail-mcp"]
    }
  }
}
```

Restart Claude Desktop, then ask: *"What folders do I have in my mail?"*

### Bootstrap script

Clones the repo, builds it, and patches the Claude config automatically:

```bash
curl -fsSL https://raw.githubusercontent.com/jayvee6/apple-mail-mcp/master/install.sh | bash
```

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

Use `which node` to get the full path to your Node binary. Restart Claude Desktop.

### Automation Permission

The first time you use a mail tool, macOS will ask whether to allow `node` to control Mail. Click **Allow**. If you accidentally deny it, go to **System Settings → Privacy & Security → Automation** and re-enable it for your terminal or Node.js runtime.

---

## Local AI (optional)

The AI tools run against any local LLM via [LM Studio](https://lmstudio.ai) or any OpenAI-compatible server. Email data never leaves your machine with the default config.

Configure via environment variables in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "apple-mail": {
      "command": "npx",
      "args": ["-y", "@jdot6/apple-mail-mcp"],
      "env": {
        "APPLE_MAIL_AI_PROVIDER": "lmstudio",
        "APPLE_MAIL_AI_ENDPOINT": "http://localhost:1234",
        "APPLE_MAIL_AI_MODEL": "gemma-4-it"
      }
    }
  }
}
```

| Variable | Default | Description |
|----------|---------|-------------|
| `APPLE_MAIL_AI_PROVIDER` | `lmstudio` | `lmstudio` \| `openai` \| `foundation` \| `none` |
| `APPLE_MAIL_AI_ENDPOINT` | `http://localhost:1234` | Base URL for the AI server |
| `APPLE_MAIL_AI_MODEL` | `gemma-4-it` | Model identifier |
| `APPLE_MAIL_AI_API_KEY` | *(none)* | Bearer token for remote providers |
| `APPLE_MAIL_AI_ENRICH_EVENTS` | *(off)* | Set to `1` to auto-classify new mail events |
| `APPLE_MAIL_AI_ALLOW_REMOTE` | *(off)* | Set to `1` to allow a non-localhost AI endpoint |

> **Privacy note:** If you point `APPLE_MAIL_AI_ENDPOINT` at a remote server (e.g. OpenAI), full email content will be sent to that server. The server blocks this by default — you must set `APPLE_MAIL_AI_ALLOW_REMOTE=1` to acknowledge and enable it.

---

## Companion Skill — Email Compose Review

The `skill/SKILL.md` file in this repo is a Claude skill that adds a multi-agent review pipeline to every email Claude drafts. Before opening a compose window, Claude runs the draft through five parallel reviewers:

| Reviewer | Checks |
|---|---|
| Slop detector | AI writing tells, filler phrases, corporate buzzwords |
| Copy editor | Spelling, grammar, punctuation |
| Active voice | Passive → active constructions |
| Correctness | Names, dates, facts match the context |
| Logic & clarity | Clear ask, logical structure, appropriate length |

An arbiter synthesizes the reviews into a revised draft and changelog. Claude shows you the result and waits for your approval before opening the draft in Mail. `send: true` is never used for LLM-drafted email — you send from Mail yourself.

To install the skill in Claude Code:
```bash
/skill install /path/to/apple-mail-mcp/skill/SKILL.md
```

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
- Email content in AI prompts is enclosed in XML delimiters (`<email>…</email>`) to guard against prompt-injection attacks in message bodies.
- Remote AI endpoints are blocked by default — set `APPLE_MAIL_AI_ALLOW_REMOTE=1` to explicitly opt in to sending email data off-device.

---

## License

MIT
