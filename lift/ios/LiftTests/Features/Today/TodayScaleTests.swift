import Foundation
import LiftCore
import LiftSync
import Testing

@testable import Lift

/// The range bar's fractions and the trend chart's ranges.
@MainActor
@Suite struct TodayScaleTests {
    @Test(arguments: [
        (HealthRangeBar(low: 48, high: 56, value: 38, min: 38, max: 64), 10.0 / 26, 18.0 / 26, 0.0),
        (HealthRangeBar(low: 40, high: 60, value: 70, min: 20, max: 60), 0.5, 1.0, 1.0),  // clamped
        (HealthRangeBar(low: 5, high: 5, value: 5, min: 5, max: 5), 0.5, 0.5, 0.5),  // no span
    ])
    func rangeScalePlacesTheBandAndTheValue(range: HealthRangeBar, low: Double, high: Double, value: Double) {
        let scale = TodayRangeScale(range)
        #expect(abs(scale.low - low) < 1e-9)
        #expect(abs(scale.high - high) < 1e-9)
        #expect(abs(scale.value - value) < 1e-9)
    }

    func point(_ day: Int, _ value: Double) -> HealthPoint {
        HealthPoint(date: PlainDay(LocalDay(year: 2026, month: 10, day: day)), value: value)
    }

    func trend(points: [HealthPoint], line: [HealthPoint]? = nil, band: HealthBand? = nil) -> HealthTrend {
        HealthTrend(
            key: "hrv", label: "HRV", unit: "ms", latestText: nil, normalText: nil, compareText: nil,
            recordedText: nil, points: points, trendLine: line, band: band, goal: HealthGoal(value: 70, label: "goal"),
            isOff: false
        )
    }

    @Test func trendScaleHoldsTheValuesTheBandAndTheGoal() {
        let scale = TodayTrendScale(
            trend(points: [point(1, 50), point(3, 40)], band: HealthBand(low: 45, high: 55)),
            calendar: SessionBuilder.calendar
        )
        #expect(scale.line.map(\.value) == [50, 40])
        #expect(scale.dots.isEmpty)
        #expect(scale.latest?.value == 40)
        #expect(scale.low < 40 && scale.high > 70)
        #expect(scale.end.timeIntervalSince(scale.start) == 2 * 86_400)
    }

    @Test func weightDrawsItsTrendAsTheLineAndWeighInsAsDots() {
        let scale = TodayTrendScale(
            trend(points: [point(5, 81)], line: [point(5, 81.4)]),
            calendar: SessionBuilder.calendar
        )
        #expect(scale.line.map(\.value) == [81.4])
        #expect(scale.dots.map(\.value) == [81])
        #expect(scale.end > scale.start)  // one day still has a width
    }
}
