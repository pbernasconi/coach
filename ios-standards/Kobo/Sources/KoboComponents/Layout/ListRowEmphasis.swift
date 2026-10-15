import KoboTokens
import SwiftUI

/// How loudly a `ListRow` speaks. `quiet` sets the title in the secondary ink, for a placeholder row that holds a
/// list's place without inviting a tap ("Nothing planned"); the row keeps its height and keyline, so it lines up with
/// the rows around it.
///
///     ListRow("Nothing planned", subtitle: "Rest day") { Image(systemName: "circle.dashed") }
///         .listRowEmphasis(.quiet)
public enum ListRowEmphasis: Sendable, Equatable, CaseIterable {
    /// The primary ink: every ordinary row.
    case standard
    /// The secondary ink: a placeholder or empty row.
    case quiet
}

extension EnvironmentValues {
    /// The emphasis rows below this point use; `.standard` by default.
    @Entry public var listRowEmphasis: ListRowEmphasis = .standard
}

extension View {
    /// Sets the emphasis of every `ListRow` inside this view.
    public func listRowEmphasis(_ emphasis: ListRowEmphasis) -> some View {
        environment(\.listRowEmphasis, emphasis)
    }
}

extension Palette {
    /// The title ink of a row with `emphasis`.
    func rowTitle(_ emphasis: ListRowEmphasis) -> Color {
        emphasis == .quiet ? textSecondary : textPrimary
    }
}
