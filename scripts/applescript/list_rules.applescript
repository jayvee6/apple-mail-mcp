-- list_rules.applescript
-- Args: (none)
-- Lists every Mail rule, one per line, tab-delimited:
--   name <tab> enabled <tab> moveTarget <tab> fromDomains
-- moveTarget: the move-action mailbox name, or "-" if the rule has no move action.
-- fromDomains: comma-joined "@domain" expressions of the rule's from-header
--   conditions (what create_rule sets), or "-" if it has none.
-- Returns "" when there are no rules.

on run
	set outLines to {}
	with timeout of 30 seconds
		tell application "Mail"
			repeat with r in rules
				set rName to name of r
				set rEnabled to (enabled of r) as text
				set mt to "-"
				try
					set mm to move message of r
					if mm is not missing value then set mt to name of mm
				end try
				set doms to {}
				repeat with c in rule conditions of r
					try
						if (rule type of c) is from header then set end of doms to (expression of c)
					end try
				end repeat
				set AppleScript's text item delimiters to ","
				set domStr to doms as text
				set AppleScript's text item delimiters to ""
				if domStr is "" then set domStr to "-"
				set end of outLines to rName & tab & rEnabled & tab & mt & tab & domStr
			end repeat
		end tell
	end timeout
	set AppleScript's text item delimiters to linefeed
	set outText to outLines as text
	set AppleScript's text item delimiters to ""
	return outText
end run
