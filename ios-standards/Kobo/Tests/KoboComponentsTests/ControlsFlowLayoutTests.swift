import Foundation
import Testing

@testable import KoboComponents

@Suite struct ControlsFlowLayoutTests {
    @Test func itemsWrapWhenTheLineIsFull() {
        let lines = FlowLines.lines(widths: [40, 40, 40], maxWidth: 100, spacing: 8)
        #expect(lines == [[0, 1], [2]])
    }

    @Test func spacingCountsTowardsTheLine() {
        #expect(FlowLines.lines(widths: [50, 50], maxWidth: 100, spacing: 0) == [[0, 1]])
        #expect(FlowLines.lines(widths: [50, 50], maxWidth: 100, spacing: 1) == [[0], [1]])
    }

    @Test func anItemWiderThanTheLineSitsAlone() {
        #expect(FlowLines.lines(widths: [20, 300, 20], maxWidth: 100, spacing: 8) == [[0], [1], [2]])
    }

    @Test func noItemsMeansNoLines() {
        #expect(FlowLines.lines(widths: [], maxWidth: 100, spacing: 8).isEmpty)
    }

    @Test func lineWidthIncludesGapsBetweenItems() {
        #expect(FlowLines.width(of: [0, 1, 2], widths: [10, 20, 30], spacing: 4) == 68)
        #expect(FlowLines.width(of: [1], widths: [10, 20, 30], spacing: 4) == 20)
        #expect(FlowLines.width(of: [], widths: [10], spacing: 4) == 0)
    }
}
