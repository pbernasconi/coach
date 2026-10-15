import Foundation

/// The two fields behind a `KoboSecureField`: the secure one and the plain one shown while revealed. Both stay in the
/// tree, so a reveal moves focus from one to the other and the keyboard stays up.
nonisolated enum SecureFieldFocus: Hashable, Sendable {
    case secure
    case plain

    /// The focus after a reveal or hide: the field now shown, or no focus when there was none.
    static func after(toggle focus: SecureFieldFocus?, revealed: Bool) -> SecureFieldFocus? {
        guard focus != nil else { return nil }
        return revealed ? .plain : .secure
    }
}
