-- reply.applescript
-- Args: acctName mboxName messageId body send("true"/"false")
-- Replies to the specified message.

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set targetId to item 3 of argv
	set msgBody to item 4 of argv
	set doSend to item 5 of argv

	tell application "Mail"
		set targetMbox to mailbox mboxName of (first account whose name = acctName)
		try
			set m to first message of targetMbox whose message id = targetId
		on error
			return "ERROR: Message not found in " & mboxName & ". The message may have been moved. Call list_emails again to refresh."
		end try
		try
			set replyMsg to reply m
			set content of replyMsg to msgBody
			if doSend = "true" then
				send replyMsg
				return "Reply sent"
			else
				set visible of replyMsg to true
				return "Reply draft opened"
			end if
		on error errMsg
			return "ERROR: Failed to create reply — " & errMsg
		end try
	end tell
end run
