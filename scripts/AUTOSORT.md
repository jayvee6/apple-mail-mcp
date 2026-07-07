# Local Gemma inbox sorter

Sort Apple Mail entirely on-device: a model in **LM Studio** picks a folder for
every inbox email, and `auto-sort.mjs` moves it. No cloud, no Claude.

The model decides; the script does the plumbing (list → ask model → validate →
move → log). That split is on purpose — a 4B model is reliable at "pick one
folder for this one email" but flaky at free-form multi-step tool use.

---

## 1. LM Studio

1. Open **LM Studio → Developer (the `</>` tab) → Start Server.**
   Confirm the address matches `http://192.168.0.231:1234` (your reported URL).
   If it's running on the *same* Mac as Apple Mail you can also use
   `http://localhost:1234`.
2. **Load your Gemma model** (the one you already have). Note its id — shown in
   the server panel and at `GET /v1/models`. The script auto-detects the first
   loaded model, so you don't have to type it.
3. Smoke-test from the Mac that will run the sorter:

   ```bash
   curl http://192.168.0.231:1234/v1/models
   ```

   You should get JSON with your model's `id`. If this fails, nothing else will
   work — fix the server/firewall first.

## 2. Preview (dry run — safe, default)

From the repo root, on the Mac with Apple Mail:

```bash
node scripts/auto-sort.mjs            # DRY_RUN defaults to 1
```

It prints what it *would* do — one line per email (`→ Folder` or `· KEEP`) and a
per-folder tally — and **moves nothing**. The first run also triggers macOS's
Automation prompt to let the script control Mail; click **OK**.

Tip: cap a quick test with `MAX_PER_ACCOUNT=20 node scripts/auto-sort.mjs`.

Read the decisions. `KEEP` = left in inbox (genuine mail, security alerts,
bills/receipts). Tune the system prompt in `auto-sort.mjs → chooseFolder()` if
Gemma's judgment is off.

## 3. Go live

```bash
DRY_RUN=0 node scripts/auto-sort.mjs
```

It only ever **moves into your existing folders** — it never deletes or junks.
Folders are read live from Mail; system mailboxes (Sent, Trash, etc.) are
excluded as destinations automatically.

## 4. Schedule it daily (launchd)

```bash
cp scripts/com.jdot.apple-mail-autosort.plist ~/Library/LaunchAgents/
# edit the two TODO paths inside it first:  `which node`  + the script path
launchctl load ~/Library/LaunchAgents/com.jdot.apple-mail-autosort.plist
```

Runs at 07:00 daily with `DRY_RUN=0`. Logs: `/tmp/apple-mail-autosort.*.log` and
`~/Library/Logs/apple-mail-autosort.log`. Unload to stop:

```bash
launchctl unload ~/Library/LaunchAgents/com.jdot.apple-mail-autosort.plist
```

Run the dry run by hand at least once before scheduling, so the Automation
permission is granted to the launchd process.

---

## Config knobs (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `LMSTUDIO_URL` | `http://192.168.0.231:1234` | LM Studio OpenAI-compatible base URL |
| `LMSTUDIO_MODEL` | auto-detect | pin a specific model id |
| `LMSTUDIO_API_KEY` | — | optional bearer token |
| `ACCOUNTS` | `iCloud,Google` | Mail account names to sort |
| `DRY_RUN` | `1` | `0` to actually move |
| `MAX_PER_ACCOUNT` | `0` | cap emails per account (0 = all) |
| `PAGE_SIZE` | `50` | inbox fetch page size |
| `TEMPERATURE` | `0` | model sampling temp |
| `LOG_FILE` | `~/Library/Logs/apple-mail-autosort.log` | extra log sink |

## Gotchas

- **Gmail:** Apple Mail "moving" a Gmail message adds the folder label but Gmail
  keeps the `INBOX` label, so sorted Gmail mail still shows in the inbox. iCloud
  moves fully. To clear Gmail too you'd archive (strip INBOX) — but this repo's
  archive targets a mailbox named `All Mail` that Mail.app can't resolve
  (it's really `[Gmail]/All Mail`). Fixing that in `organize.ts`/`move` would let
  the sorter clear Gmail as well; ask if you want that change.
- **Permissions:** the runner needs Automation access to Mail (and Mail must be
  running). Grant it on the first manual run.
- **Don't point the MCP's built-in AI tools at this LAN box without
  `APPLE_MAIL_AI_ALLOW_REMOTE=1`** — see below.

## Optional: also run the MCP's own AI tools on this LM Studio

If you want `classify_email` / `triage_inbox` / `summarize_email` (the MCP tools)
to use the same model, set these env vars for the **MCP server** process:

```bash
APPLE_MAIL_AI_PROVIDER=openai          # use the OpenAI-compatible path (/v1/chat/completions)
APPLE_MAIL_AI_ENDPOINT=http://192.168.0.231:1234
APPLE_MAIL_AI_MODEL=<your model id>
APPLE_MAIL_AI_ALLOW_REMOTE=1           # required: 192.168.x.x is not localhost
```

Use `openai`, **not** `lmstudio`: the built-in `lmstudio` provider posts to
`/api/v1/chat`, which a stock LM Studio server doesn't serve (its OpenAI API is
`/v1/chat/completions`; its native REST is `/api/v0/`). The `openai-compat`
provider hits the right path. `auto-sort.mjs` already talks to `/v1` directly, so
it doesn't depend on this.
