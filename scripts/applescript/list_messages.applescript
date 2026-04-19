-- list_messages.applescript
-- Args: acctName mboxName offset(1-based) limit
-- Returns tab-delimited lines: messageId TAB subject TAB sender TAB dateReceived TAB isRead

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set offsetNum to item 3 of argv as integer
	set limitNum to item 4 of argv as integer

	set output to ""
	tell application "Mail"
		set targetMbox to mailbox mboxName of (first account whose name = acctName)
		set allMsgs to messages of targetMbox
		set total to count of allMsgs
		if total = 0 then return ""

		set fromIdx to offsetNum
		if fromIdx > total then return ""
		set toIdx to offsetNum + limitNum - 1
		if toIdx > total then set toIdx to total

		set pageMsgs to items fromIdx thru toIdx of allMsgs
		repeat with m in pageMsgs
			set msgId to message id of m
			set subj to subject of m
			set sndr to sender of m
			set dt to date received of m as string
			set isRead to read status of m
			if isRead then
				set readStr to "true"
			else
				set readStr to "false"
			end if
			set output to output & msgId & tab & subj & tab & sndr & tab & dt & tab & readStr & linefeed
		end repeat
	end tell
	return output
end run
