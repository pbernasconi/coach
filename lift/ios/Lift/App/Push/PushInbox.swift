import Foundation

/// What iOS hands the app delegate, held until the shell takes it. A tap that launched Lift, or the APNs token, can
/// come before the tabs exist; the shell attaches once its data is ready and gets them then. Practice mode starts the
/// shell over, and the new shell attaches again: it gets the last token too.
final class PushInbox {
    /// The latest APNs token, as hex.
    private(set) var token: String?
    /// The latest tap no shell has taken. A newer tap replaces it.
    private(set) var parkedTap: PushTap?
    private var onToken: ((String) -> Void)?
    private var onTap: ((PushTap) -> Void)?

    func tokenReceived(_ token: String) {
        self.token = token
        onToken?(token)
    }

    func tapped(_ tap: PushTap) {
        if let onTap {
            onTap(tap)
        } else {
            parkedTap = tap
        }
    }

    /// Hands the token and the parked tap over at once, then every later one.
    func attach(onToken: @escaping (String) -> Void, onTap: @escaping (PushTap) -> Void) {
        self.onToken = onToken
        self.onTap = onTap
        if let token { onToken(token) }
        if let tap = parkedTap {
            parkedTap = nil
            onTap(tap)
        }
    }
}
