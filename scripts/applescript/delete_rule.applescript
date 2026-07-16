-- delete_rule.applescript
-- Args: ruleName
-- Deletes every rule with the given name (a rule is identified by its name here).
-- Returns "OK|deleted=N|remaining=M", or "ERROR: ..." if no such rule exists.

on run argv
	set ruleName to item 1 of argv
	with timeout of 30 seconds
		tell application "Mail"
			set n to count of (rules whose name is ruleName)
			if n is 0 then return "ERROR: No rule named '" & ruleName & "'. Use list_rules to see existing rules."
			set deletedCount to 0
			repeat n times
				try
					delete (first rule whose name is ruleName)
					set deletedCount to deletedCount + 1
				end try
			end repeat
			return "OK|deleted=" & deletedCount & "|remaining=" & (count of rules)
		end tell
	end timeout
end run
