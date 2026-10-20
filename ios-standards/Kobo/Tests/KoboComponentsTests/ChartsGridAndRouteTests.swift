import Foundation
import Testing

@testable import KoboComponents

@Suite struct ChartsGridAndRouteTests {
    // MARK: Heatmap

    private static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        calendar.firstWeekday = 2  // Monday
        return calendar
    }

    /// Wednesday 2024-03-13, noon UTC.
    private static let wednesday = Date(timeIntervalSince1970: 1_710_331_200)

    private static func day(_ offset: Int) -> Date {
        wednesday.addingTimeInterval(Double(offset) * 86_400)
    }

    @Test func gridHasWeeksOfSevenStartingOnTheFirstWeekday() {
        let grid = HeatmapMath.grid(days: [], weeks: 3, end: Self.wednesday, levels: 4, calendar: Self.calendar)
        #expect(grid.count == 3)
        #expect(grid.allSatisfy { $0.count == 7 })
        let firstDay = grid[0][0].date
        #expect(Self.calendar.component(.weekday, from: firstDay) == 2)
        #expect(grid[2][2].date == Self.calendar.startOfDay(for: Self.wednesday))
    }

    @Test func gridMarksTheRestOfThisWeekAsFuture() {
        let grid = HeatmapMath.grid(days: [], weeks: 1, end: Self.wednesday, levels: 4, calendar: Self.calendar)
        #expect(grid[0].map(\.isFuture) == [false, false, false, true, true, true, true])
    }

    @Test func gridAddsValuesOnTheSameDayAndShadesThem() {
        let days = [
            HeatmapDay(date: Self.day(0), value: 10), HeatmapDay(date: Self.day(0), value: 30),
            HeatmapDay(date: Self.day(-1), value: 10), HeatmapDay(date: Self.day(-60), value: 99),
        ]
        let grid = HeatmapMath.grid(days: days, weeks: 1, end: Self.wednesday, levels: 4, calendar: Self.calendar)
        #expect(grid[0][2].value == 40)
        #expect(grid[0][2].level == 4)
        #expect(grid[0][1].level == 1)
        #expect(grid[0][0].level == 0)
    }

    @Test(arguments: [(0.0, 0), (-3.0, 0), (1.0, 1), (25.0, 1), (26.0, 2), (75.0, 3), (100.0, 4), (150.0, 4)])
    func levels(value: Double, expected: Int) {
        #expect(HeatmapMath.level(value, max: 100, levels: 4) == expected)
    }

    @Test func activeDaysAndStreakSkipFutureDays() {
        let days = [Self.day(-2), Self.day(-1), Self.day(0), Self.day(-5)].map { HeatmapDay(date: $0, value: 1) }
        let grid = HeatmapMath.grid(days: days, weeks: 2, end: Self.wednesday, levels: 4, calendar: Self.calendar)
        let active = HeatmapMath.activeDays(in: grid)
        #expect(active.active == 4)
        #expect(active.total == 10)
        #expect(HeatmapMath.longestStreak(in: grid) == 3)
    }

    @Test func nonFiniteDaysAreSkipped() {
        let days = [HeatmapDay(date: Self.day(0), value: .infinity), HeatmapDay(date: Self.day(-1), value: 5)]
        let grid = HeatmapMath.grid(days: days, weeks: 1, end: Self.wednesday, levels: 4, calendar: Self.calendar)
        #expect(grid[0][2].level == 0)
        #expect(grid[0][1].level == 4)
        #expect(HeatmapMath.level(.nan, max: 10, levels: 4) == 0)
    }

    @Test func spansAcrossTheAntimeridianAreCapped() throws {
        let points = [GeoPoint(latitude: 0.5, longitude: -179.9), GeoPoint(latitude: 1, longitude: 179.9)]
        let bounds = try #require(RouteMath.bounds(points, padding: 0.5))
        #expect(bounds.longitudeSpan <= 360)
    }

    @Test func noWeeksIsEmpty() {
        #expect(HeatmapMath.grid(days: [], weeks: 0, end: Self.wednesday, levels: 4, calendar: Self.calendar).isEmpty)
    }

    // MARK: Routes

    @Test func validDropsMissingFixesAndOutOfRange() {
        let points = [
            GeoPoint(latitude: 0, longitude: 0), GeoPoint(latitude: 47.3, longitude: 8.5),
            GeoPoint(latitude: 91, longitude: 8), GeoPoint(latitude: .nan, longitude: 8),
            GeoPoint(latitude: 47.4, longitude: 8.6),
        ]
        #expect(RouteMath.valid(points).count == 2)
    }

    @Test func boundsPadTheRoute() throws {
        let points = [GeoPoint(latitude: 10, longitude: 20), GeoPoint(latitude: 11, longitude: 22)]
        let bounds = try #require(RouteMath.bounds(points, padding: 0.1))
        #expect(abs(bounds.minLatitude - 9.9) < 1e-9)
        #expect(abs(bounds.maxLongitude - 22.2) < 1e-9)
        #expect(bounds.center == GeoPoint(latitude: 10.5, longitude: 21))
    }

    @Test func boundsOfOnePointHaveAMinimumSpan() throws {
        let bounds = try #require(RouteMath.bounds([GeoPoint(latitude: 10, longitude: 20)]))
        #expect(abs(bounds.latitudeSpan - RouteMath.minimumSpan) < 1e-12)
        #expect(abs(bounds.longitudeSpan - RouteMath.minimumSpan) < 1e-12)
        #expect(RouteMath.bounds([]) == nil)
    }

    @Test func thinnedKeepsEndsOfLongTracks() {
        let track = (0..<2_000).map { GeoPoint(latitude: Double($0) / 1_000, longitude: 1) }
        let thin = RouteMath.thinned(track, maxPoints: 100)
        #expect(thin.count == 100)
        #expect(thin.first == track.first)
        #expect(thin.last == track.last)
    }

    // MARK: Spoken summaries

    @Test func seriesSpeech() {
        #expect(ChartSpeech.series([4, 3, 9, 7]) { "\(Int($0))" } == "From 4 to 7, low 3, high 9")
        #expect(ChartSpeech.series([]) { "\($0)" } == "No data")
    }

    @Test func linesSpeechNamesEachSeries() {
        let text = ChartSpeech.lines([("A", [1, 2]), ("B", []), ("", [5, 6])]) { "\(Int($0))" }
        #expect(text == "A: From 1 to 2, low 1, high 2. From 5 to 6, low 5, high 6")
    }

    @Test func barsSpeech() {
        let text = ChartSpeech.bars(totals: [2, 6, 4], labels: ["W1", "W2", "W3"]) { "\(Int($0))" }
        #expect(text == "3 bars, average 4, highest 6 on W2")
        #expect(ChartSpeech.bars(totals: [], labels: []) { "\($0)" } == "No data")
    }

    @Test func histogramSpeech() {
        let bins = HistogramBin.bins([3, 4, 12], width: 5)
        #expect(ChartSpeech.histogram(bins, average: 6) { "\(Int($0))" } == "Most values from 0 to 5, average 6")
        #expect(ChartSpeech.histogram([], average: nil) { "\($0)" } == "No data")
    }

    @Test func heatmapSpeech() {
        #expect(
            ChartSpeech.heatmap(active: 12, total: 28, streak: 4) == "Active on 12 of 28 days, longest streak 4 days"
        )
    }
}
