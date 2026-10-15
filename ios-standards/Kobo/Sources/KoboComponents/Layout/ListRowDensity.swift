import KoboTokens
import SwiftUI

/// How tightly `ListRow` (and the rows built on it, such as `CheckRow`) packs its content. `compact` fits long lists
/// of short items on one screen: less vertical padding, a 44pt minimum height, a footnote subtitle and a subheadline
/// trailing value (one step above the subtitle, as body is in a regular row). Rows still grow
/// with Dynamic Type, so nothing truncates at accessibility sizes.
///
///     ListSection { ForEach(items) { ListRow(verbatim: $0.name, subtitle: $0.detail) } }
///         .listRowDensity(.compact)
nonisolated public enum ListRowDensity: Sendable, Equatable, CaseIterable {
    /// `Space.rowVertical` padding and `Size.rowMinHeight`: settings and short lists.
    case regular
    /// `Space.sm` padding and `Size.minTouch`: long browsing lists.
    case compact

    /// The padding above and below the row's content.
    public var verticalPadding: CGFloat {
        switch self {
        case .regular: Space.rowVertical
        case .compact: Space.sm
        }
    }

    /// The smallest height of a row.
    public var minHeight: CGFloat {
        switch self {
        case .regular: Size.rowMinHeight
        case .compact: Size.minTouch
        }
    }
}

extension EnvironmentValues {
    /// The density rows below this point use; `.regular` by default.
    @Entry public var listRowDensity: ListRowDensity = .regular
}

extension View {
    /// Sets the density of every `ListRow` inside this view.
    public func listRowDensity(_ density: ListRowDensity) -> some View {
        environment(\.listRowDensity, density)
    }
}
