import Foundation
import MailKit

/// Handles every message Mail.app downloads. On first invocation (headers
/// only, no body) we return `.invokeAgainWithBody` so MailKit calls us a
/// second time with the full RFC 2822 payload. On the second invocation we
/// extract the event fields and POST to apple-mail-mcp, then return
/// `.actions([])` to leave the message untouched.
class MessageActionHandler: NSObject, MEMessageActionHandler {

    // Tell MailKit which headers we need on the first (header-only) call.
    // This avoids an unnecessary round-trip for messages we can already
    // identify from headers alone — but we still request the body for the
    // preview, so this is informational only.
    var requiredHeaders: [String] {
        return ["message-id", "subject", "from", "date"]
    }

    func decideAction(
        for message: MEMessage,
        completionHandler: @escaping (MEMessageActionDecision) -> Void
    ) {
        // rawData is nil on the first invocation (header-only pass).
        // Request a second call with the full message body.
        guard let rawData = message.rawData, !rawData.isEmpty else {
            completionHandler(MEMessageActionDecision.invokeAgainWithBody)
            return
        }

        // --- Extract fields ---

        let subject = message.subject ?? "(no subject)"
        let from = message.fromAddress.addressString

        // Prefer the Date: header (already a string); fall back to now.
        let date = message.headers["date"]?.first
            ?? ISO8601DateFormatter().string(from: Date())

        // message-id header per RFC 2822 (angle brackets included is fine).
        let messageId = message.headers["message-id"]?.first
            ?? UUID().uuidString

        let preview = extractPreview(from: rawData)

        let encryptionState: String? = {
            switch message.encryptionState {
            case .encrypted:       return "encrypted"
            case .encryptionFailed: return "encryptionFailed"
            default:               return nil  // notEncrypted — omit to keep payload lean
            }
        }()

        EventPoster.post(MailEvent(
            subject: subject,
            from: from,
            date: date,
            messageId: messageId,
            preview: preview,
            encryptionState: encryptionState
        ))

        // Return no actions — we only observe, we never move/flag/etc.
        completionHandler(MEMessageActionDecision.actions([]))
    }

    // MARK: - Preview extraction

    /// Parse the RFC 2822 body out of rawData and return the first 200
    /// printable characters. Handles CRLF and LF line endings.
    private func extractPreview(from data: Data) -> String {
        guard let raw = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .isoLatin1) else {
            return ""
        }

        // RFC 2822: headers and body are separated by a blank line (CRLF CRLF
        // or LF LF in practice).
        let separator: String
        if raw.contains("\r\n\r\n") {
            separator = "\r\n\r\n"
        } else {
            separator = "\n\n"
        }

        guard let range = raw.range(of: separator) else {
            return ""
        }

        let body = String(raw[range.upperBound...])
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // Strip quoted-printable soft line breaks and excess whitespace so
        // the preview reads naturally.
        let cleaned = body
            .replacingOccurrences(of: "=\r\n", with: "")
            .replacingOccurrences(of: "=\n", with: "")
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\n", with: " ")

        // Limit to 200 characters.
        let limit = cleaned.index(cleaned.startIndex,
                                  offsetBy: min(200, cleaned.count))
        return String(cleaned[..<limit])
    }
}
