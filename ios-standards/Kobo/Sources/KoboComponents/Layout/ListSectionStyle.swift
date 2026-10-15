import Foundation  // CGFloat; no SwiftUI, so the metrics are tested on Linux
import KoboTokens

/// How a `ListSection` lays out its rows. Pick it with `.listSectionStyle(_:)`; pages default to `.flat`, and Kobo's
/// sheets switch to `.grouped`.
///
/// Both styles keep one keyline: the section's header and footer start at the page gutter, like every title on the
/// page. A flat row's content starts there too; a grouped card's edge does, and its rows sit one `Space.cardInset` in.
nonisolated public enum ListSectionStyle: Sendable, Equatable, CaseIterable {
    /// Full-width rows on the page canvas, with no card around them: the style for a page's top-level lists. Each row
    /// pays the gutter itself, so its press fill runs edge to edge and its separator starts at the keyline.
    case flat
    /// Rows in a rounded surface card that sits at the gutter: forms, sheets and grouped fields.
    case grouped

    /// The space between a row's edge and its content.
    public var rowInset: CGFloat {
        switch self {
        case .flat: Space.gutter
        case .grouped: Space.cardInset
        }
    }

    /// How far the header and footer sit in from the section's edge. A flat section inside a page gutter is already
    /// on the keyline; one outside a gutter (a full-width container) pays the gutter itself, as its rows do.
    public func captionInset(insidePageGutter: Bool) -> CGFloat {
        switch self {
        case .flat: insidePageGutter ? 0 : Space.gutter
        case .grouped: 0
        }
    }

    /// How far the rows run past the section's edges on each side: a flat section inside a page gutter runs its rows
    /// out to the screen edges, so the rows' own inset puts their content back on the keyline.
    public func rowBleed(insidePageGutter: Bool) -> CGFloat {
        self == .flat && insidePageGutter ? Space.gutter : 0
    }

    /// Where a row's separator starts: at its text, after the row inset and any leading slot (`leadingWidth`, with
    /// its gap).
    public func separatorInset(leadingWidth: CGFloat) -> CGFloat {
        rowInset + leadingWidth
    }
}
