-- create_mailbox.applescript
-- Args: acctName mboxName
--   acctName: account the mailbox belongs to, e.g. "iCloud"
--   mboxName: name of the new top-level mailbox in that account, e.g. "Newsletters"
-- Creates the mailbox inside the account if it does not already exist (idempotent).
-- Returns a human-readable status line, or "ERROR:" on failure.

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv

	tell application "Mail"
		if not (exists account acctName) then
			return "ERROR: Account not found: " & acctName & ". Use list_folders to see available accounts."
		end if
		set acct to first account whose name = acctName

		-- Idempotent: a mailbox with this name already exists in the account.
		repeat with mbox in (mailboxes of acct)
			if name of mbox = mboxName then
				return "Mailbox already exists: " & mboxName & " in " & acctName
			end if
		end repeat

		-- Create the mailbox *inside the account*. The account-scoped `tell` is the
		-- reliable form: `make new mailbox with properties {name:"Account/Folder"}`
		-- silently creates a local top-level mailbox on modern Mail instead.
		tell acct to make new mailbox with properties {name:mboxName}
		return "Created mailbox " & mboxName & " in " & acctName
	end tell
end run
