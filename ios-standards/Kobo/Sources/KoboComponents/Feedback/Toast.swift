import Foundation
import KoboTokens

/// One short, transient message for `ToastCenter`: copy, a tone, an optional glyph and an optional action.
///
///     center.show(Toast("Set deleted", tone: .neutral, action: .init("Undo") { restore() }))
///
/// Two toasts are equal only when they are the same toast (same `id`), because a closure has no identity to compare.
///
/// The copy is stored resolved, as `String`, so the toast stays `Sendable` and testable without SwiftUI. Literal copy
/// goes through the `LocalizedStringResource` initialisers (declared next to `toastHost`), which resolve it from the
/// app's bundle; runtime copy goes through `init(verbatim:)`.
nonisolated public struct Toast: Identifiable, Equatable, Sendable {
    /// The one trailing text action ("Undo", "View"). Performing it also dismisses the toast.
    nonisolated public struct Action: Sendable {
        public let label: String
        public let perform: @MainActor @Sendable () -> Void

        /// An action whose label is shown as is.
        public init(verbatim label: String, perform: @escaping @MainActor @Sendable () -> Void) {
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

    /// A toast whose message is shown as is (user data, names).
    ///
    /// - Parameter duration: `nil` picks `defaultDuration(hasAction:)`: longer when there is an action to reach.
    public init(
        verbatim message: String,
        tone: Tone = .neutral,
        symbol: String? = nil,
        action: Action? = nil,
        duration: Duration? = nil,
        id: UUID = UUID()
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
    @MainActor var announcement: String {
        guard let action else { return message }
        return message + ". " + String(localized: "\(action.label) available", bundle: .module)
    }
}
