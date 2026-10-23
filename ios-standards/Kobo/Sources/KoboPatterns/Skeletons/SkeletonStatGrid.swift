import KoboComponents
import KoboTokens
import SwiftUI

/// Ghost numbers in a grid: each cell a short label line over a larger value line, `columns` to a row (one at
/// accessibility sizes). `.plain` cells sit in the caller's card (add `.koboCard()`), as a card of headline numbers
/// does; `.tiles` gives each cell its own surface, in the geometry of a `TileGrid` of `StatTile`s. Put it in a
/// `.skeletonPage()` stack, which breathes and labels it.
///
///     SkeletonStatGrid(count: 6).koboCard()
///     SkeletonStatGrid(count: 4, style: .tiles)
public struct SkeletonStatGrid: View {
    /// How the cells sit.
    public enum Style: Sendable, Equatable, CaseIterable {
        /// Cells on the caller's surface, a little apart, as numbers inside one card.
        case plain
        /// Each cell on its own rounded surface, as `StatTile`s in a `TileGrid`.
        case tiles
    }

    private let count: Int
    private let columns: Int
    private let style: Style
    private let valueRole: Typography.Role
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var typeSize

    /// - Parameters:
    ///   - count: how many cells.
    ///   - columns: cells per row at standard text sizes.
    ///   - valueRole: the type role of the values the cells stand in for (`.headline` for small numbers).
    public init(count: Int = 4, columns: Int = 2, style: Style = .plain, valueRole: Typography.Role = .title2) {
        self.count = max(count, 0)
        self.columns = columns
        self.style = style
        self.valueRole = valueRole
    }

    public var body: some View {
        let perRow = SkeletonLayout.columns(columns, isAccessibilitySize: typeSize.isAccessibilitySize)
        let rows = SkeletonLayout.rows(count: count, columns: perRow)
        VStack(alignment: .leading, spacing: style == .tiles ? Space.sm : Space.lg) {
            ForEach(SkeletonSlot.slots(rows.count)) { row in
                HStack(alignment: .top, spacing: style == .tiles ? Space.sm : Space.md) {
                    ForEach(SkeletonSlot.slots(perRow)) { column in
                        let index = row.id * perRow + column.id
                        if index < count {
                            cell(index)
                        } else {
                            Color.clear.frame(maxWidth: .infinity, maxHeight: 0)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityHidden(true)
    }

    @ViewBuilder private func cell(_ index: Int) -> some View {
        let lines = VStack(alignment: .leading, spacing: Space.xxs) {
            Skeleton(.line, textRole: style == .tiles ? .caption : .subheadline)
                .frame(maxWidth: SkeletonLayout.shortLineWidth(index))
            Skeleton(.line, textRole: valueRole)
                .frame(maxWidth: SkeletonLayout.shortLineWidth(index + 1))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        switch style {
        case .plain:
            lines
        case .tiles:
            lines
                .padding(.horizontal, Space.md)
                .padding(.vertical, Space.rowVertical)
                .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        }
    }
}

#if DEBUG
    private struct SkeletonStatGridPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.section) {
                SkeletonStatGrid(count: 6).koboCard()
                SkeletonStatGrid(count: 6, columns: 3, valueRole: .headline).koboCard()
                SkeletonStatGrid(count: 3, style: .tiles)
            }
            .skeletonPage()
            .pageGutter()
            .screenCanvas()
        }
    }

    #Preview("Skeleton stat grid") { SkeletonStatGridPreview() }
    #Preview("Skeleton stat grid, dark") { SkeletonStatGridPreview().preferredColorScheme(.dark) }
    #Preview("Skeleton stat grid, AX3") { SkeletonStatGridPreview().dynamicTypeSize(.accessibility3) }
#endif
