-- get_message.applescript
-- Args: acctName mboxName messageId
-- Returns: multi-line text with headers then body
-- Format: KEY: VALUE lines, then blank line, then body content

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set targetId to item 3 of argv

	tell application "Mail"
		set targetMbox to mailbox mboxName of (first account whose name = acctName)
		try
			set m to first message of targetMbox whose message id = targetId
		on error
			return "ERROR: Message not found in " & mboxName & ". The message may have been moved. Call list_emails again to refresh."
		end try
		set subj to subject of m
		set sndr to sender of m
		set dt to date received of m as string
		set isRead to read status of m
		set isFlagged to flagged status of m
		set replyTo to reply to of m
		set msgBody to content of m
		set output to "Subject: " & subj & linefeed
		set output to output & "From: " & sndr & linefeed
		set output to output & "Date: " & dt & linefeed
		set output to output & "Message-ID: " & targetId & linefeed
		set output to output & "Read: " & (isRead as string) & linefeed
		set output to output & "Flagged: " & (isFlagged as string) & linefeed
		if replyTo is not "" then
			set output to output & "Reply-To: " & replyTo & linefeed
		end if
		set output to output & linefeed & msgBody
		return output
	end tell
end run
