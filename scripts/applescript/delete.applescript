-- delete.applescript
-- Args: acctName mboxName messageId trashMailbox
--   trashMailbox: name of the trash mailbox (iCloud="Deleted Messages", Gmail="Trash")
-- Moves the specified message to the trash mailbox.

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set targetId to item 3 of argv
	set trashName to item 4 of argv

	tell application "Mail"
		set acct to first account whose name = acctName
		set trashMailbox to mailbox trashName of acct
		set srcMailbox to mailbox mboxName of acct
		try
			set m to first message of srcMailbox whose message id = targetId
		on error
			return "ERROR: Message not found in " & mboxName & ". The message may have been moved. Call list_emails again to refresh."
		end try
		move m to trashMailbox
		return "Moved to " & trashName
	end tell
end run
