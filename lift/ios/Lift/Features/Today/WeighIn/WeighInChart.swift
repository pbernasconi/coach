import Foundation
import LiftCore
import LiftSync

/// The weigh-in screen's chart: every reading as a dot, the trend through them as the line, and today on top.
nonisolated struct WeighInChart: Equatable, Sendable {
    /// The readings, oldest first.
    var points: [WeighInChartPoint]
    /// The y axis: the lowest to the highest reading or trend, padded so the dots clear the edges.
    var range: ClosedRange<Double>
    /// What VoiceOver reads for the whole chart.
    var accessibilitySummary: String

    /// The chart of `weighIn`, or nil with fewer than two readings (one dot is not a trend).
    static func make(_ weighIn: AppWeighIn, days: DayCalendar) -> WeighInChart? {
        let points = weighIn.series.compactMap { point in
            days.date(of: point.date.day).map { WeighInChartPoint(date: $0, kg: point.kg, trendKg: point.trendKg) }
        }
        guard points.count > 1 else { return nil }
        let values = points.flatMap { [$0.kg] + ($0.trendKg.map { [$0] } ?? []) }
        let low = values.min() ?? 0
        let high = values.max() ?? 0
        let pad = max((high - low) * 0.1, 0.2)
        return WeighInChart(
            points: points,
            range: (low - pad)...(high + pad),
            accessibilitySummary: summary(weighIn, count: points.count)
        )
    }

    private static func summary(_ weighIn: AppWeighIn, count: Int) -> String {
        let readings = String(localized: "\(count) weigh-ins in 12 weeks.")
        guard let trend = weighIn.trend else { return readings }
        let rate = trend.rate.map { " \($0.text)." } ?? ""
        return readings + " " + String(localized: "Trend \(trend.text) kg.") + rate
    }
}

/// One reading on the chart.
nonisolated struct WeighInChartPoint: Equatable, Sendable, Identifiable {
    /// The start of the reading's day.
    var date: Date
    var kg: Double
    /// The trend through this reading; nil from servers that predate it.
    var trendKg: Double?

    var id: Date { date }
}
