import Foundation

/// JSON payload that mirrors the `MailEvent` interface in apple-mail-mcp's
/// `src/event-queue.ts`. Field names must match exactly.
struct MailEvent: Encodable {
    let subject: String
    let from: String
    let date: String
    let messageId: String
    let preview: String
    let encryptionState: String?
}

/// Fire-and-forget HTTP poster. Posts a single `MailEvent` to the
/// apple-mail-mcp bridge on localhost:27182. Errors are silently dropped —
/// the MCP server may not be running and that must not affect Mail.app.
enum EventPoster {

    static let bridgeURL = URL(string: "http://127.0.0.1:27182/event")!
    static let encoder = JSONEncoder()

    static func post(_ event: MailEvent) {
        guard let body = try? encoder.encode(event) else { return }

        var request = URLRequest(url: bridgeURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        request.timeoutInterval = 2

        // dataTask is intentionally not retained — fire and forget.
        // If the MCP server isn't running the connection is refused
        // immediately and the task is silently released.
        URLSession.shared.dataTask(with: request).resume()
    }
}
