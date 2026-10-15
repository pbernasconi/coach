import Foundation

/// The rules of a copy (`tapToCopy`, `CopyButton`, `CopyableValue`), apart from SwiftUI.
nonisolated enum CopyRules {
    /// The value dims to this opacity for a moment after a tap.
    static let dimmedOpacity = 0.4
    /// How long the small check stays after a copy.
    static let checkHold: Duration = .milliseconds(1500)
    /// The scale the check springs in from.
    static let checkStartScale = 0.6
    /// How long a copied value stays on the pasteboard by default.
    static let defaultLifetime: Duration = .seconds(60)

    /// `"setup key"` → `"Setup key"`: the confirmation starts with the name of what was copied.
    static func capitalizedFirst(_ text: String) -> String {
        guard let first = text.first else { return text }
        return first.uppercased() + text.dropFirst()
    }

    /// The display of a value that may be masked: the mask until revealed, or whenever there is nothing to reveal.
    static func displayed(value: String?, maskedValue: String?, revealed: Bool) -> String? {
        guard let maskedValue, !revealed || value == nil else { return value }
        return maskedValue
    }

    /// The reveal toggle needs a value to reveal, a mask to return to, and the caller's opt-in.
    static func canReveal(value: String?, maskedValue: String?, revealable: Bool) -> Bool {
        value != nil && maskedValue != nil && revealable
    }
}
