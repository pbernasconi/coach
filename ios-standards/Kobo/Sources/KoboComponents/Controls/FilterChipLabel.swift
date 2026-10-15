import Foundation

/// What an active `FilterChip` shows for its chosen values, apart from SwiftUI: the first one, then "+N" for the rest.
///
///     FilterChipLabel.summary(["Vegetarian"])                   // "Vegetarian"
///     FilterChipLabel.summary(["Vegetarian", "Vegan", "Halal"])  // "Vegetarian +2"
nonisolated public enum FilterChipLabel {
    /// `nil` when nothing is chosen, so the chip names its filter instead.
    public static func summary(_ titles: [String]) -> String? {
        guard let first = titles.first else { return nil }
        let rest = titles.count - 1
        return rest > 0 ? "\(first) +\(rest.formatted())" : first
    }
}
