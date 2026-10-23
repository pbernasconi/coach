import Foundation
import KoboTokens

/// The maths of the skeleton blocks (`SkeletonHeader`, `SkeletonStatGrid`, `SkeletonCard`): how many columns a grid
/// uses and how wide each ghost line is. Pure, so tests check it without rendering.
nonisolated enum SkeletonLayout {
    /// The columns of a grid: as requested (at least one), one at accessibility text sizes, as the real grids do.
    static func columns(_ requested: Int, isAccessibilitySize: Bool) -> Int {
        isAccessibilitySize ? 1 : max(requested, 1)
    }

    /// The rows of `count` cells in `columns`: each row holds the indices of its cells, the last row shorter.
    static func rows(count: Int, columns: Int) -> [[Int]] {
        let width = max(columns, 1)
        return stride(from: 0, to: max(count, 0), by: width).map { Array($0..<min($0 + width, count)) }
    }

    /// The widest a ghost body line is, by its place in a paragraph: full lines, and a shorter last line, so the
    /// block reads as text and not as a stack of bars.
    static func bodyLineWidth(_ index: Int, of count: Int) -> CGFloat? {
        index == count - 1 && count > 1 ? Size.minTouch * 4 : nil
    }

    /// The widest a short ghost line is (a label, a value): three lengths in turn, so a row of cells does not read as
    /// one repeated shape.
    static func shortLineWidth(_ index: Int) -> CGFloat {
        let steps: [CGFloat] = [2, 1.5, 2.5]
        return Size.minTouch * steps[((index % steps.count) + steps.count) % steps.count]
    }
}
