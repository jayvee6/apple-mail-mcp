import SwiftUI

@main
struct MailKitBridgeApp: App {
    var body: some Scene {
        // Minimal container app required to host the Mail extension.
        // No UI needed — the extension runs inside Mail.app.
        WindowGroup("MailKit Bridge") {
            ContentView()
        }
        .windowResizability(.contentSize)
    }
}
