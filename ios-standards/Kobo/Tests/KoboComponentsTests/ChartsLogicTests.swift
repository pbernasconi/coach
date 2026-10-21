import Foundation
import Testing

@testable import KoboComponents

@Suite struct ChartsLogicTests {
    // MARK: Summary and direction

    @Test func summaryReadsFirstLastLowHigh() {
        let summary = ChartMath.summary([4, 3, 9, 7])
        #expect(summary == SeriesSummary(first: 4, last: 7, low: 3, high: 9, direction: .up))
    }

    @Test(arguments: [
        ([1.0, 5], SeriesSummary.Direction.up),
        ([5.0, 1], .down),
        ([3.0, 3, 3], .flat),
        ([0.0, 10, 0.1], .flat),
    ])
    func summaryDirection(values: [Double], expected: SeriesSummary.Direction) {
        #expect(ChartMath.summary(values)?.direction == expected)
    }

    @Test func summarySkipsNonFiniteAndEmpty() {
        #expect(ChartMath.summary([]) == nil)
        #expect(ChartMath.summary([.nan, .infinity]) == nil)
        #expect(ChartMath.summary([.nan, 2, 4])?.first == 2)
    }

    // MARK: Nearest point

    @Test(arguments: [(-5.0, 0), (0.0, 0), (4.0, 0), (6.0, 1), (5.0, 0), (14.0, 1), (16.0, 2), (99.0, 2)])
    func nearestIndex(target: Double, expected: Int) {
        #expect(ChartMath.nearestIndex(in: [0, 10, 20], to: target) == expected)
    }

    @Test func nearestIndexWithNothingToFind() {
        #expect(ChartMath.nearestIndex(in: [], to: 3) == nil)
        #expect(ChartMath.nearestIndex(in: [1, 2], to: .nan) == nil)
        #expect(ChartMath.nearestIndex(in: [7], to: -100) == 0)
    }

    // MARK: Domains, ticks, spans

    @Test func domainPadsBothSides() {
        let domain = ChartMath.domain([10, 20], padding: 0.1)
        #expect(abs(domain.lowerBound - 9) < 1e-9)
        #expect(abs(domain.upperBound - 21) < 1e-9)
    }

    @Test func domainOfFlatEmptyAndZeroBased() {
        #expect(ChartMath.domain([5, 5]) == 4.5...5.5)
        #expect(ChartMath.domain([]) == 0...1)
        #expect(ChartMath.domain([3, 8], padding: 0.1, includesZero: true).lowerBound == 0)
        #expect(ChartMath.domain([-8, -3], padding: 0.1, includesZero: true).upperBound == 0)
    }

    @Test func logTicksUseOneTwoFive() {
        #expect(ChartMath.logTicks(lower: 5, upper: 100, maxCount: 10) == [5, 10, 20, 50, 100])
        #expect(ChartMath.logTicks(lower: 0, upper: 100).isEmpty)
        #expect(ChartMath.logTicks(lower: 10, upper: 5).isEmpty)
    }

    @Test func logTicksThinToTheLimitKeepingEnds() {
        let ticks = ChartMath.logTicks(lower: 1, upper: 10_000, maxCount: 4)
        #expect(ticks.count == 4)
        #expect(ticks.first == 1)
        #expect(ticks.last == 10_000)
    }

    @Test func thinnedKeepsShortListsAndEnds() {
        #expect(ChartMath.thinned([1, 2, 3], to: 5) == [1, 2, 3])
        #expect(ChartMath.thinned(Array(0...10), to: 3) == [0, 5, 10])
        #expect(ChartMath.thinned(Array(0...10), to: 1) == [0])
    }

    @Test func strideIndicesEndOnTheLast() {
        #expect(ChartMath.strideIndices(count: 10, maxCount: 6) == [1, 3, 5, 7, 9])
        #expect(ChartMath.strideIndices(count: 4, maxCount: 6) == [0, 1, 2, 3])
        #expect(ChartMath.strideIndices(count: 12, maxCount: 3) == [3, 7, 11])
        #expect(ChartMath.strideIndices(count: 0, maxCount: 3).isEmpty)
    }

    @Test func extremaKeepPeaksEndsAndOrder() {
        let values = (0..<1_000).map { Double($0 % 50) } + [412] + (0..<1_000).map { Double($0 % 50) }
        let kept = ChartMath.extremaIndices(values, maxCount: 100)
        #expect(kept.count <= 100)
        #expect(kept.first == 0)
        #expect(kept.last == values.count - 1)
        #expect(kept == kept.sorted())
        #expect(kept.contains(1_000), "the peak survives")
        #expect(ChartMath.extremaIndices([1, 2, 3], maxCount: 100) == [0, 1, 2])
    }

    @Test(arguments: [("▼ 7%", "down 7%"), ("▲ 3 km", "up 3 km"), ("+5", "+5")])
    func deltaArrowsAreSpoken(text: String, expected: String) {
        #expect(DeltaSpeech.spoken(text) == expected)
    }

    @Test func firstIndicesKeepTheFirstOfEachName() {
        #expect(ChartMath.firstIndices(of: ["Fitness", "Fatigue", "Fitness", "Form"]) == [0, 1, 3])
        #expect(ChartMath.firstIndices(of: []).isEmpty)
    }

    @Test func spansTreatNonFiniteWidthsAsZero() {
        #expect(ChartMath.spans(widths: [1, .nan, .infinity, 2]) == [0..<1, 1..<1, 1..<1, 1..<3])
    }

    @Test func thinnedToZeroIsEmpty() {
        #expect(ChartMath.thinned([1, 2, 3], to: 0).isEmpty)
    }

    @Test func spansLayWidthsEndToEnd() {
        #expect(ChartMath.spans(widths: [2, 3, -1, 1]) == [0..<2, 2..<5, 5..<5, 5..<6])
        #expect(ChartMath.spans(widths: []).isEmpty)
    }

    @Test func meanAndFraction() {
        #expect(ChartMath.mean([1, 2, 3, .nan]) == 2)
        #expect(ChartMath.mean([]) == nil)
        #expect(ChartMath.fraction(5, of: 10) == 0.5)
        #expect(ChartMath.fraction(15, of: 10) == 1)
        #expect(ChartMath.fraction(-1, of: 10) == 0)
        #expect(ChartMath.fraction(5, of: 0) == 0)
    }

    // MARK: Histogram

    @Test func histogramBinsAlignToWidthAndKeepGaps() {
        let bins = HistogramBin.bins([3, 4, 12, .nan], width: 5)
        #expect(bins.map(\.lower) == [0, 5, 10])
        #expect(bins.map(\.count) == [2, 0, 1])
        #expect(bins.last?.upper == 15)
    }

    @Test func histogramBinsHandleNegativesAndBadInput() {
        #expect(HistogramBin.bins([-3, 2], width: 5).map(\.lower) == [-5, 0])
        #expect(HistogramBin.bins([1, 2], width: 0).isEmpty)
        #expect(HistogramBin.bins([], width: 5).isEmpty)
    }

    @Test func histogramRefusesHugeSpreads() {
        #expect(HistogramBin.bins([0, 1e9], width: 1).isEmpty)
        #expect(HistogramBin.bins([0, 1e300], width: 1e-300).isEmpty)
        #expect(HistogramBin.bins([1, 2], width: .infinity).isEmpty)
        #expect(HistogramBin.bins([0, 999], width: 1).count == 1_000)
    }

    @Test func histogramModeIsTheFirstFullest() {
        let bins = [
            HistogramBin(lower: 0, upper: 1, count: 2), HistogramBin(lower: 1, upper: 2, count: 4),
            HistogramBin(lower: 2, upper: 3, count: 4),
        ]
        #expect(HistogramBin.mode(of: bins)?.lower == 1)
        #expect(HistogramBin.mode(of: []) == nil)
    }

    // MARK: Shares and bands

    @Test func percentagesAlwaysAddUpToHundred() {
        #expect(ShareMath.percentages([1, 1, 1]) == [34, 33, 33])
        #expect(ShareMath.percentages([600, 1_920, 900, 420, 60]).reduce(0, +) == 100)
        #expect(ShareMath.percentages([0, 0]) == [0, 0])
        #expect(ShareMath.percentages([-5, 5]) == [0, 100])
    }

    @Test func fractionsIgnoreNegativeAndNonFinite() {
        #expect(ShareMath.fractions([1, 3, -2, .nan]) == [0.25, 0.75, 0, 0])
    }

    @Test(arguments: [(5.0, BandPosition.below), (10, .within), (15, .within), (20, .within), (21, .above)])
    func bandPosition(value: Double, expected: BandPosition) {
        #expect(BandPosition(value, band: 10...20) == expected)
    }

    @Test func noBandIsWithin() {
        #expect(BandPosition(99, band: nil) == .within)
    }

    // MARK: Table text

    @Test func tableRowReadsHeaderValuePairs() {
        let columns = [DataTableColumn("Date"), DataTableColumn("Distance", kind: .numeric), DataTableColumn("Time")]
        let row = DataTableRow(id: "1", cells: ["Mar 4", " ", "1:02"])
        #expect(DataTableText.accessibilityText(columns: columns, row: row) == "Mar 4, Time 1:02")
        let short = DataTableRow(id: "2", cells: ["Mar 5"])
        #expect(DataTableText.accessibilityText(columns: columns, row: short) == "Mar 5")
    }

    @Test func columnIdDefaultsToTitle() {
        #expect(DataTableColumn("Date").id == "Date")
        #expect(DataTableColumn("Date", id: "d").id == "d")
    }
}
