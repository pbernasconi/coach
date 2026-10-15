import Foundation

/// One chip of an `ActionChipRow`: an SF Symbol, a short label, how it draws and what a tap does. Build the set from
/// screen state, so a paused item shows "Resume" in place of "Pause". The label is shown as is; resolve literal copy
/// with `String(localized:)`.
///
///     ActionChip(symbol: "pencil", label: String(localized: "Rename")) { rename() }
nonisolated public struct ActionChip: Identifiable, Sendable {
    /// The fill and ink of a chip.
    public enum Look: Sendable, Equatable, CaseIterable {
        /// The accent tint: most actions.
        case tonal
        /// The solid accent capsule of the one promoted action.
        case filled
        /// The danger tint, for an action that removes or ends something.
        case destructive
    }

    public let id: String
    public let symbol: String
    public let label: String
    public let look: Look
    /// A spinner replaces the glyph while this chip's own work runs; the chip ignores taps meanwhile.
    public let isLoading: Bool
    public let action: @MainActor @Sendable () -> Void

    /// - Parameter id: stable across state changes; the label by default.
    public init(
        id: String? = nil,
        symbol: String,
        label: String,
        look: Look = .tonal,
        isLoading: Bool = false,
        action: @escaping @MainActor @Sendable () -> Void
    ) {
        self.id = id ?? label
        self.symbol = symbol
        self.label = label
        self.look = look
        self.isLoading = isLoading
        self.action = action
    }
}
