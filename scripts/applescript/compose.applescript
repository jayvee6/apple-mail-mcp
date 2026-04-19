-- compose.applescript
-- Args: toAddr subject body cc send("true"/"false")
-- Creates a new outgoing message. If send="true", sends immediately.
-- If send="false", opens compose window with draft.

on run argv
	set toAddr to item 1 of argv
	set subj to item 2 of argv
	set msgBody to item 3 of argv
	set ccAddr to item 4 of argv
	set doSend to item 5 of argv

	tell application "Mail"
		set newMsg to make new outgoing message with properties {subject:subj, content:msgBody, visible:true}
		tell newMsg
			make new to recipient with properties {address:toAddr}
			if ccAddr is not "" then
				make new cc recipient with properties {address:ccAddr}
			end if
		end tell
		if doSend = "true" then
			send newMsg
			return "Sent to " & toAddr
		else
			return "Draft opened for " & toAddr
		end if
	end tell
end run
