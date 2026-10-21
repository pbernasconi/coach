import Foundation

/// How `TileGrid` splits its items into rows: consecutive runs of `columns`, the last one shorter.
nonisolated enum TileGridRows {
    /// `count` items in rows of `columns`: 5 in 2 gives `[0..<2, 2..<4, 4..<5]`. Fewer than one column reads as one.
    static func rows(count: Int, columns: Int) -> [Range<Int>] {
        let width = max(columns, 1)
        return stride(from: 0, to: max(count, 0), by: width).map { $0..<min($0 + width, count) }
    }
}
