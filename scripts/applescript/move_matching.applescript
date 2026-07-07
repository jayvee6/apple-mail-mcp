-- move_matching.applescript
-- Args: srcAcct srcMbox fromFilter subjectFilter afterDate beforeDate destAcct destMbox limit
--   srcAcct/srcMbox: source account + mailbox to scan
--   fromFilter: substring match on sender, or "" to skip
--   subjectFilter: substring match on subject, or "" to skip
--   afterDate/beforeDate: ISO date "YYYY-MM-DD" or "" to skip
--   destAcct/destMbox: destination account + mailbox (must already exist)
--   limit: max messages to move; "0" means no cap (move ALL matches)
--
-- Two move strategies:
--  * Native bulk move (fast): exactly one text filter, no date filters, no cap.
--    Mail moves the whole `whose` result in one internal operation; the moved
--    count is derived from the destination mailbox delta (avoids a second,
--    expensive `whose` pass just to count).
--  * Individual move (general): collects matches (honoring limit + multiple
--    filters + dates), then moves them one at a time. Mail cannot move a *list*
--    in a single call ("cannot convert"), and the collected message-id refs stay
--    valid as siblings are moved, so the per-message loop is safe.
-- Returns "Moved N message(s) ..." or "ERROR:" on failure.

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
	set srcAcct to item 1 of argv
	set srcMbox to item 2 of argv
	set fromFilter to item 3 of argv
	set subjectFilter to item 4 of argv
	set afterDateStr to item 5 of argv
	set beforeDateStr to item 6 of argv
	set destAcct to item 7 of argv
	set destMbox to item 8 of argv
	set limitNum to item 9 of argv as integer

	set afterDate to missing value
	set beforeDate to missing value
	if afterDateStr is not "" then set afterDate to my isoToDate(afterDateStr)
	if beforeDateStr is not "" then set beforeDate to my isoToDate(beforeDateStr)

	tell application "Mail"
		-- Give Mail generous time: on a large or actively-syncing mailbox a whose-scan
		-- can exceed the default ~2min AppleEvent limit and fail (-1712) before
		-- runScript's Node timeout even applies. Kept just under that 600s cap.
		with timeout of 570 seconds
		-- Resolve destination first so we fail before touching any messages.
		try
			set destMailbox to mailbox destMbox of (first account whose name = destAcct)
		on error
			return "ERROR: Destination mailbox not found: " & destAcct & "/" & destMbox & ". Verify with list_folders, or create it first with create_folder."
		end try
		try
			set srcMailbox to mailbox srcMbox of (first account whose name = srcAcct)
		on error
			return "ERROR: Source mailbox not found: " & srcAcct & "/" & srcMbox & ". Verify with list_folders."
		end try

		set noDates to (afterDateStr is "" and beforeDateStr is "")

		-- Fast path: single text filter, no dates, no cap → native bulk move.
		-- Count moved via the destination delta so `whose` runs only once.
		if limitNum is 0 and noDates and fromFilter is not "" and subjectFilter is "" then
			set beforeN to (count of messages of destMailbox)
			move (messages of srcMailbox whose sender contains fromFilter) to destMailbox
			set movedCount to (count of messages of destMailbox) - beforeN
			return "Moved " & movedCount & " message(s) to " & destAcct & "/" & destMbox & "."
		else if limitNum is 0 and noDates and subjectFilter is not "" and fromFilter is "" then
			set beforeN to (count of messages of destMailbox)
			move (messages of srcMailbox whose subject contains subjectFilter) to destMailbox
			set movedCount to (count of messages of destMailbox) - beforeN
			return "Moved " & movedCount & " message(s) to " & destAcct & "/" & destMbox & "."
		end if

		-- General path: pick the most selective single filter for the whose-clause,
		-- then re-check every criterion in the loop (whose narrows by one at most).
		if fromFilter is not "" then
			set candidates to (messages of srcMailbox whose sender contains fromFilter)
		else if subjectFilter is not "" then
			set candidates to (messages of srcMailbox whose subject contains subjectFilter)
		else
			set candidates to messages of srcMailbox
		end if

		-- Collect matches without mutating the mailbox yet (limitNum 0 = no cap).
		set toMove to {}
		repeat with m in candidates
			if limitNum > 0 and (count of toMove) ≥ limitNum then exit repeat

			set passFilter to true
			if fromFilter is not "" and sender of m does not contain fromFilter then set passFilter to false
			if subjectFilter is not "" and subject of m does not contain subjectFilter then set passFilter to false
			if afterDate is not missing value and date received of m < afterDate then set passFilter to false
			if beforeDate is not missing value and date received of m > beforeDate then set passFilter to false

			if passFilter then set end of toMove to (contents of m)
		end repeat

		if (count of toMove) is 0 then
			return "Moved 0 messages — no messages matched in " & srcAcct & "/" & srcMbox & "."
		end if

		-- Move each individually — Mail rejects moving a list in one call.
		set movedCount to 0
		repeat with msgRef in toMove
			move msgRef to destMailbox
			set movedCount to movedCount + 1
		end repeat
		return "Moved " & movedCount & " message(s) to " & destAcct & "/" & destMbox & "."
		end timeout
	end tell
end run
