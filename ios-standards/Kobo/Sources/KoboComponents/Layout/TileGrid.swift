import Foundation
import KoboTokens
import SwiftUI

/// Tiles in rows of `columns` (one at accessibility sizes), every tile in a row as tall as the tallest and top-aligned
/// (`StatTile`s stretch through `.statTileRow()`). A short last row keeps its tiles at one column's width.
///
///     TileGrid(stats) { stat in StatTile(verbatim: stat.label, value: stat.value) }
///     TileGrid(stats, id: \.label, columns: 3) { stat in StatTile(verbatim: stat.label, value: stat.value) }
public struct TileGrid<Item, ID: Hashable, Tile: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let items: [Item]
    private let id: KeyPath<Item, ID>
    private let columns: Int
    private let tile: (Item) -> Tile

    /// - Parameters:
    ///   - id: a stable id for each item, so tiles keep their identity when the data changes.
    ///   - columns: tiles per row at standard text sizes.
    public init(
        _ items: some Collection<Item>,
        id: KeyPath<Item, ID>,
        columns: Int = 2,
        @ViewBuilder tile: @escaping (Item) -> Tile
    ) {
        self.items = Array(items)
        self.id = id
        self.columns = max(columns, 1)
        self.tile = tile
    }

    public var body: some View {
        let perRow = dynamicTypeSize.isAccessibilitySize ? 1 : columns
        let rows = TileGridRows.rows(count: items.count, columns: perRow).map { range in
            TileRow(id: items[range.lowerBound][keyPath: id], items: Array(items[range]))
        }
        Grid(horizontalSpacing: Space.sm, verticalSpacing: Space.sm) {
            ForEach(rows) { row in
                GridRow(alignment: .top) {
                    ForEach(row.items, id: id) { item in tile(item) }
                    if row.items.count < perRow {
                        Color.clear
                            .gridCellColumns(perRow - row.items.count)
                            .gridCellUnsizedAxes([.horizontal, .vertical])
                    }
                }
            }
        }
        .statTileRow()
    }

    /// One row, named by its first item's id.
    private struct TileRow: Identifiable {
        let id: ID
        let items: [Item]
    }
}

extension TileGrid where Item: Identifiable, ID == Item.ID {
    /// Tiles for identifiable items.
    public init(_ items: some Collection<Item>, columns: Int = 2, @ViewBuilder tile: @escaping (Item) -> Tile) {
        self.init(items, id: \.id, columns: columns, tile: tile)
    }
}

private struct TileGridPreview: View {
    @Environment(\.koboTheme) private var theme
    private let stats = [
        ("Distance", "42.1", "km"), ("Time", "3:12", nil), ("Pace", "4:34", "/km"),
        ("Climb", "640", "m"), ("Calories", "2,410", nil),
    ]

    var body: some View {
        TileGrid(stats, id: \.0) { stat in
            if stat.0 == "Pace" {
                StatTile(
                    verbatim: stat.0,
                    value: stat.1,
                    unit: stat.2,
                    delta: .textOnly(verbatim: "▲ 2%", tone: .success)
                )
            } else {
                StatTile(verbatim: stat.0, value: stat.1, unit: stat.2)
            }
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Tile grid") { TileGridPreview() }
    #Preview("Tile grid, dark") { TileGridPreview().preferredColorScheme(.dark) }
    #Preview("Tile grid, AX3") { TileGridPreview().dynamicTypeSize(.accessibility3) }
#endif
