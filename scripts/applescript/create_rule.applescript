-- create_rule.applescript
-- Args: ruleName account destMailbox domainsCSV
--   ruleName:    display name of the rule (also the idempotency key)
--   account:     account whose folder is the move target, e.g. "iCloud"
--   destMailbox: existing mailbox name in that account to move matches into
--   domainsCSV:  comma-separated sender domains, already normalized
--                (lowercase, no leading "@"/"www."), e.g. "newsletter.com,shop.de"
--
-- Creates ONE native Mail rule whose conditions are OR-combined:
--   (from header contains "@domainA") OR (... "@domainB") ...  -> move to account/destMailbox
-- It is a real Mail.app rule, so Mail applies it to incoming mail itself — no
-- background process. Rules run while Mail is open; they do not retroactively
-- sort existing mail (the caller handles that separately via move_matching).
--
-- Idempotent: an existing rule with the same name is deleted first (a rule IS
-- its name here). After creating, the script reads back the move action + the
-- conditions and, if Mail's setters misfired (occasionally flaky / iCloud-sync
-- latency), deletes the half-built rule and returns ERROR — never leaving a
-- broken rule behind.
--
-- Returns a machine-parseable "OK|...|..." line, or "ERROR: ..." (the MCP
-- runner turns the ERROR: prefix into a tool error).

on run argv
	set ruleName to item 1 of argv
	set acctName to item 2 of argv
	set destMbox to item 3 of argv
	set domainsCSV to item 4 of argv

	set AppleScript's text item delimiters to ","
	set domainList to text items of domainsCSV
	set AppleScript's text item delimiters to ""

	with timeout of 60 seconds
		tell application "Mail"
			-- Destination must already exist (fail before touching any rules).
			try
				set destBox to mailbox destMbox of (first account whose name is acctName)
			on error
				return "ERROR: Destination mailbox not found: " & acctName & "/" & destMbox & ". Create it with create_folder first, or verify with list_folders."
			end try

			-- Idempotency: remove any existing rule with the same name.
			set replacedCount to 0
			repeat (count of (rules whose name is ruleName)) times
				try
					delete (first rule whose name is ruleName)
					set replacedCount to replacedCount + 1
				end try
			end repeat

			-- Create the rule with OR-combined domain conditions.
			set theRule to make new rule with properties {name:ruleName, enabled:true}
			set all conditions must be met of theRule to false
			set addedDomains to 0
			set addedConds to 0
			repeat with d in domainList
				set dText to (d as text)
				if dText is not "" then
					-- Two OR-conditions per domain so BOTH the apex (foo@crypto.com)
					-- and any subdomain (foo@news.crypto.com) match — without false
					-- positives like "notcrypto.com". Mail rules have no regex, so
					-- this is the precise substring pair: "@domain" + ".domain".
					make new rule condition at end of rule conditions of theRule with properties {rule type:from header, qualifier:does contain value, expression:"@" & dText}
					make new rule condition at end of rule conditions of theRule with properties {rule type:from header, qualifier:does contain value, expression:"." & dText}
					set addedDomains to addedDomains + 1
					set addedConds to addedConds + 2
				end if
			end repeat
			if addedConds is 0 then
				try
					delete theRule
				end try
				return "ERROR: no valid domains provided."
			end if
			set move message of theRule to destBox
			set should move message of theRule to true

			-- Verify everything stuck (read all values BEFORE any cleanup).
			set okMove to false
			try
				if (move message of theRule) is not missing value then set okMove to true
			end try
			set shouldMoveVal to (should move message of theRule)
			set nConds to (count of rule conditions of theRule)
			if (not okMove) or (shouldMoveVal is false) or (nConds is not addedConds) then
				try
					delete theRule
				end try
				return "ERROR: rule did not persist correctly (moveSet=" & okMove & ", shouldMove=" & shouldMoveVal & ", conds=" & nConds & "/" & addedConds & "). No rule left behind."
			end if

			return "OK|rule=" & ruleName & "|dest=" & acctName & "/" & destMbox & "|domains=" & addedDomains & "|conds=" & addedConds & "|replaced=" & replacedCount & "|enabled=true"
		end tell
	end timeout
end run
