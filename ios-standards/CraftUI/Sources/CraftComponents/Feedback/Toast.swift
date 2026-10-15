import CraftTokens
import Foundation

/// One short, transient message for `ToastCenter`: copy, a tone, an optional glyph and an optional action.
///
///     center.show(Toast("Set deleted", tone: .neutral, action: .init("Undo") { restore() }))
///
/// Two toasts are equal only when they are the same toast (same `id`), because a closure has no identity to compare.
nonisolated public struct Toast: Identifiable, Equatable, Sendable {
    /// The one trailing text action ("Undo", "View"). Performing it also dismisses the toast.
    nonisolated public struct Action: Sendable {
        public let label: String
        public let perform: @MainActor @Sendable () -> Void

        public init(_ label: String, perform: @escaping @MainActor @Sendable () -> Void) {
            self.label = label
            self.perform = perform
        }
    }

    public let id: UUID
    public let message: String
    public let tone: Tone
    /// An SF Symbol; `nil` uses the tone's own glyph.
    public let symbol: String?
    public let action: Action?
    /// How long the toast stays before it dismisses itself.
    public let duration: Duration

    /// - Parameter duration: `nil` picks `defaultDuration(hasAction:)`: longer when there is an action to reach.
    public init(
        id: UUID = UUID(),
        _ message: String,
        tone: Tone = .neutral,
        symbol: String? = nil,
        action: Action? = nil,
        duration: Duration? = nil
    ) {
        self.id = id
        self.message = message
        self.tone = tone
        self.symbol = symbol
        self.action = action
        self.duration = duration ?? Self.defaultDuration(hasAction: action != nil)
    }

    /// The glyph drawn in the toast.
    public var resolvedSymbol: String { symbol ?? tone.feedbackSymbol }

    public static func == (lhs: Toast, rhs: Toast) -> Bool { lhs.id == rhs.id }

    /// A plain toast reads in 4 s; one with an action stays 7 s so there is time to reach it.
    public static func defaultDuration(hasAction: Bool) -> Duration {
        hasAction ? .seconds(7) : .seconds(4)
    }

    /// What VoiceOver speaks when the toast appears: the message, then "Undo available" when there is an action.
    var announcement: String {
        guard let action else { return message }
        return message + ". " + String(localized: "\(action.label) available")
    }
}
