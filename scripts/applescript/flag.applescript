-- flag.applescript
-- Args: acctName mboxName messageId flagged("true"/"false")
-- Sets the flagged status of the specified message.

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set targetId to item 3 of argv
	set doFlag to item 4 of argv

	if doFlag = "true" then
		set flagValue to true
	else
		set flagValue to false
	end if

	tell application "Mail"
		set targetMbox to mailbox mboxName of (first account whose name = acctName)
		try
			set m to first message of targetMbox whose message id = targetId
		on error
			return "ERROR: Message not found in " & mboxName & ". The message may have been moved. Call list_emails again to refresh."
		end try
		set flagged status of m to flagValue
		return "Flagged status set to " & doFlag
	end tell
end run
