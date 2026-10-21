import KoboComponents
import KoboTokens
import SwiftUI

/// Tiles two to a row (one at accessibility sizes), every tile in a row as tall as the tallest and top-aligned.
struct TileGrid<Item, Tile: View>: View {
    let items: [Item]
    @ViewBuilder let tile: (Item) -> Tile
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let columns = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        let rows = stride(from: 0, to: items.count, by: columns).map { Array($0..<min($0 + columns, items.count)) }
        Grid(horizontalSpacing: Space.sm, verticalSpacing: Space.sm) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                GridRow(alignment: .top) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, index in tile(items[index]) }
                    if row.count < columns {
                        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                    }
                }
            }
        }
    }
}
