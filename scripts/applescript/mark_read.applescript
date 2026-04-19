-- mark_read.applescript
-- Args: acctName mboxName messageId read("true"/"false")
-- Sets the read status of the specified message.

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set targetId to item 3 of argv
	set doRead to item 4 of argv

	if doRead = "true" then
		set readValue to true
	else
		set readValue to false
	end if

	tell application "Mail"
		set targetMbox to mailbox mboxName of (first account whose name = acctName)
		repeat with m in messages of targetMbox
			if message id of m = targetId then
				set read status of m to readValue
				return "Read status set to " & doRead
			end if
		end repeat
	end tell
	return "ERROR: Message not found in " & mboxName & ". The message may have been moved. Call list_emails again to refresh."
end run
