-- move.applescript
-- Args: srcAccount srcMailbox messageId destAccount destMailbox
-- Moves the specified message to the destination mailbox.

on run argv
	set srcAcct to item 1 of argv
	set srcMbox to item 2 of argv
	set targetId to item 3 of argv
	set destAcct to item 4 of argv
	set destMbox to item 5 of argv

	tell application "Mail"
		set destMailbox to mailbox destMbox of (first account whose name = destAcct)
		set srcMailbox to mailbox srcMbox of (first account whose name = srcAcct)
		repeat with m in messages of srcMailbox
			if message id of m = targetId then
				move m to destMailbox
				return "Moved to " & destAcct & "/" & destMbox
			end if
		end repeat
	end tell
	return "ERROR: Message not found in " & srcMbox & ". The message may have been moved. Call list_emails again to refresh."
end run
