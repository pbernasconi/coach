import Foundation
import KoboTokens
import SwiftUI
import Testing

@testable import KoboComponents

/// Chart models that live in SwiftUI files (they hold a `Color`), so these run on Apple platforms only.
@Suite struct ChartsModelTests {
    @Test func seriesSortsPointsAndDropsNonFinite() {
        let series = ChartSeries(
            id: "a",
            name: "A",
            points: [ChartPoint(x: 3.0, y: 1), ChartPoint(x: 1.0, y: .nan), ChartPoint(x: 2.0, y: 5)]
        )
        #expect(series.points.map(\.x) == [2, 3])
    }

    @Test func seriesFindsTheNearestPoint() {
        let series = ChartSeries(id: "a", name: "A", points: [0.0, 10, 20].map { ChartPoint(x: $0, y: $0 * 2) })
        #expect(series.nearest(to: 12)?.y == 20)
        #expect(ChartSeries<Double>(id: "e", name: "E", points: []).nearest(to: 1) == nil)
    }

    @Test func dateXUsesSecondsAsPosition() {
        let date = Date(timeIntervalSinceReferenceDate: 120)
        #expect(date.chartPosition == 120)
        #expect(7.chartPosition == 7)
    }

    @Test func barGroupStacksInCategoryOrderAndSkipsEmpty() {
        let categories = [
            BarCategory(id: "a", name: "A"), BarCategory(id: "b", name: "B"), BarCategory(id: "c", name: "C"),
        ]
        let group = BarGroup(x: 1, values: ["c": 2, "a": 3, "b": 0, "x": 9])
        let segments = group.segments(categories)
        #expect(segments.map(\.category) == [0, 2])
        #expect(segments.map(\.span) == [0..<3, 3..<5])
        #expect(group.total == 14)
    }

    @Test func barGroupDropsNonFiniteValues() {
        let group = BarGroup(x: 1, values: ["a": .nan, "b": 2, "c": .infinity])
        #expect(group.segments([BarCategory(id: "a", name: "A"), BarCategory(id: "b", name: "B")]).count == 1)
        #expect(group.total == 2)
    }

    @Test func seriesPointCoveringSkipsXOutsideItsSpan() {
        let series = ChartSeries(id: "a", name: "A", points: [5.0, 10].map { ChartPoint(x: $0, y: $0) })
        #expect(series.point(covering: 2) == nil)
        #expect(series.point(covering: 9)?.x == 10)
        #expect(series.point(covering: 11) == nil)
    }

    @Test func longSeriesAreThinnedForDrawing() {
        let series = ChartSeries(id: "a", name: "A", points: (0..<5_000).map { ChartPoint(x: Double($0), y: 1) })
        #expect(series.plotted.count <= ChartSeries<Double>.maxPlotted)
        #expect(series.plotted.last?.x == 4_999)
    }

    @Test func sameNameSeriesReadAsOne() {
        let chart = KoboLineChart(
            series: [
                ChartSeries(id: "a", name: "Score", points: [1.0, 2].map { ChartPoint(x: $0, y: $0 * 10) }),
                ChartSeries(
                    id: "b",
                    name: "Score",
                    points: [2.0, 3].map { ChartPoint(x: $0, y: $0 * 10) },
                    stroke: .dashed
                ),
            ],
            xText: { "\($0)" },
            yText: { "\(Int($0))" },
            accessibilityLabel: "Score"
        )
        #expect(chart.summary == "Score: From 10 to 30, low 10, high 30")
        #expect(chart.legend.map(\.name) == ["Score"])
    }

    @Test func peaksSurviveDrawing() {
        let points = (0..<5_000).map { ChartPoint(x: Double($0), y: $0 == 2_500 ? 999 : 1) }
        let series = ChartSeries(id: "a", name: "A", points: points)
        #expect(series.plotted.contains { $0.y == 999 })
    }

    @Test func chartColorsCycleAndAcceptAnyIndex() {
        let palette = Theme.system.palette
        #expect(palette.chartColor(0) == palette.accent)
        #expect(palette.chartColor(1) == palette.info.ink)
        #expect(palette.chartColor(6) == palette.chartColor(0))
        #expect(palette.chartColor(-1) == palette.chartColor(5))
    }

    @Test func chartHeightsGrow() {
        #expect(ChartHeight.compact.points < ChartHeight.regular.points)
        #expect(ChartHeight.regular.points < ChartHeight.tall.points)
    }
}
