import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "envelope.badge")
                .imageScale(.large)
                .font(.system(size: 48))
                .foregroundStyle(.blue)

            Text("MailKit Bridge")
                .font(.headline)

            Text("This app hosts the MailKit Bridge extension.\nEnable it in System Settings → Privacy & Security → Mail Extensions.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .font(.subheadline)

            Link("Open Mail Extension Settings",
                 destination: URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_MailExtensions")!)
                .buttonStyle(.borderedProminent)
        }
        .padding(32)
        .frame(width: 420)
    }
}
