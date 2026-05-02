-- search.applescript
-- Args: acctName mboxName fromFilter subjectFilter afterDate beforeDate limit
--   acctName: account name, or "ALL" to search all accounts
--   mboxName: mailbox name, or "ALL" to search all mailboxes within the account
--   fromFilter: substring match on sender, or "" to skip
--   subjectFilter: substring match on subject, or "" to skip
--   afterDate: ISO date string "YYYY-MM-DD" or "" to skip
--   beforeDate: ISO date string "YYYY-MM-DD" or "" to skip
--   limit: max results (integer)
-- Returns tab-delimited lines: messageId TAB account TAB mailbox TAB subject TAB sender TAB dateReceived TAB isRead

on isoToDate(isoStr)
	-- Parse "YYYY-MM-DD" into an AppleScript date
	set yr to (text 1 thru 4 of isoStr) as integer
	set mo to (text 6 thru 7 of isoStr) as integer
	set dy to (text 9 thru 10 of isoStr) as integer
	set d to current date
	set year of d to yr
	set month of d to mo
	set day of d to dy
	set hours of d to 0
	set minutes of d to 0
	set seconds of d to 0
	return d
end isoToDate

on run argv
	set acctName to item 1 of argv
	set mboxName to item 2 of argv
	set fromFilter to item 3 of argv
	set subjectFilter to item 4 of argv
	set afterDateStr to item 5 of argv
	set beforeDateStr to item 6 of argv
	set limitNum to item 7 of argv as integer

	set afterDate to missing value
	set beforeDate to missing value
	if afterDateStr is not "" then set afterDate to my isoToDate(afterDateStr)
	if beforeDateStr is not "" then set beforeDate to my isoToDate(beforeDateStr)

	set output to ""
	set resultCount to 0

	tell application "Mail"
		-- Build list of accounts to search
		set acctList to {}
		if acctName = "ALL" then
			set acctList to accounts
		else
			set acctList to {first account whose name = acctName}
		end if

		repeat with acct in acctList
			set curAcctName to name of acct

			-- Build list of mailboxes to search
			set mboxList to {}
			if mboxName = "ALL" then
				set mboxList to mailboxes of acct
			else
				set mboxList to {mailbox mboxName of acct}
			end if

			repeat with mbox in mboxList
				set curMboxName to name of mbox

				-- Start with all messages; use whose clause for the most selective single filter
				set candidates to {}
				if fromFilter is not "" then
					set candidates to (messages of mbox whose sender contains fromFilter)
				else if subjectFilter is not "" then
					set candidates to (messages of mbox whose subject contains subjectFilter)
				else
					set candidates to messages of mbox
				end if

				-- Apply remaining filters in a loop (whose clause above narrows by at most one
				-- criterion; check all criteria here to handle the multi-filter case correctly)
				repeat with m in candidates
					if resultCount >= limitNum then exit repeat

					set passFilter to true

					if fromFilter is not "" and sender of m does not contain fromFilter then
						set passFilter to false
					end if
					if subjectFilter is not "" and subject of m does not contain subjectFilter then
						set passFilter to false
					end if
					if afterDate is not missing value and date received of m < afterDate then
						set passFilter to false
					end if
					if beforeDate is not missing value and date received of m > beforeDate then
						set passFilter to false
					end if

					if passFilter then
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
						set output to output & msgId & tab & curAcctName & tab & curMboxName & tab & subj & tab & sndr & tab & dt & tab & readStr & linefeed
						set resultCount to resultCount + 1
					end if
				end repeat
				if resultCount >= limitNum then exit repeat
			end repeat
			if resultCount >= limitNum then exit repeat
		end repeat
	end tell
	return output
end run
