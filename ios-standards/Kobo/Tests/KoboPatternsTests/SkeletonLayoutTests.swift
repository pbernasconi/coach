import Foundation
import KoboTokens
import Testing

@testable import KoboPatterns

@Suite struct SkeletonLayoutTests {
    @Test(arguments: [(2, false, 2), (3, false, 3), (0, false, 1), (3, true, 1)])
    func columnsDropToOneAtAccessibilitySizes(requested: Int, isAccessibilitySize: Bool, expected: Int) {
        #expect(SkeletonLayout.columns(requested, isAccessibilitySize: isAccessibilitySize) == expected)
    }

    @Test func rowsSplitTheCellsWithAShortLastRow() {
        #expect(SkeletonLayout.rows(count: 5, columns: 2) == [[0, 1], [2, 3], [4]])
        #expect(SkeletonLayout.rows(count: 6, columns: 3) == [[0, 1, 2], [3, 4, 5]])
        #expect(SkeletonLayout.rows(count: 0, columns: 2).isEmpty)
        #expect(SkeletonLayout.rows(count: 2, columns: 0) == [[0], [1]])
    }

    @Test func onlyTheLastLineOfAParagraphIsShort() {
        #expect(SkeletonLayout.bodyLineWidth(0, of: 3) == nil)
        #expect(SkeletonLayout.bodyLineWidth(2, of: 3) == Size.minTouch * 4)
        #expect(SkeletonLayout.bodyLineWidth(0, of: 1) == nil)
    }

    @Test func shortLinesCycleThroughThreeWidths() {
        let widths = (0..<6).map(SkeletonLayout.shortLineWidth)
        #expect(Array(widths[0..<3]) == Array(widths[3..<6]))
        #expect(Set(widths).count == 3)
    }
}
