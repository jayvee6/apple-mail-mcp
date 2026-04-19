import MailKit

/// Entry point for the MailKit extension. Mail.app discovers this class via
/// NSExtensionPrincipalClass in Info.plist and calls the appropriate handler
/// factories based on which protocols the extension adopts.
@objc(MailKitBridgeExtension)
class MailKitBridgeExtension: NSObject, MEExtension {

    /// Return the message action handler. Called once by Mail.app when it
    /// initialises the extension. The returned object receives
    /// `decideAction(for:completionHandler:)` for every downloaded message.
    func handlerForMessageActions() -> MEMessageActionHandler {
        return MessageActionHandler()
    }
}
