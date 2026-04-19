-- list_folders.applescript
-- No args. Returns tab-delimited lines: accountName TAB mailboxName
-- Output parsed by TypeScript into a folder tree.

on run argv
	set output to ""
	tell application "Mail"
		repeat with acct in accounts
			set acctName to name of acct
			repeat with mbox in mailboxes of acct
				set mboxName to name of mbox
				set output to output & acctName & tab & mboxName & linefeed
			end repeat
		end repeat
	end tell
	return output
end run
