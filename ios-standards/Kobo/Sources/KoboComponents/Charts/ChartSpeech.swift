import Foundation

/// What VoiceOver reads as a chart's value: short sentences built from the chart's numbers, in the library's own
/// strings (`bundle: .module`). The caller's formatters turn numbers into text, so units stay the caller's.
nonisolated enum ChartSpeech {
    /// "From 4 to 7, low 3, high 9", or "No data".
    static func series(_ values: [Double], format: (Double) -> String) -> String {
        guard let summary = ChartMath.summary(values) else { return noData }
        let first = format(summary.first)
        let last = format(summary.last)
        let low = format(summary.low)
        let high = format(summary.high)
        return String(localized: "From \(first) to \(last), low \(low), high \(high)", bundle: .module)
    }

    /// One sentence per named series: "Load: from 4 to 7, low 3, high 9. Goal: …".
    static func lines(_ series: [(name: String, values: [Double])], format: (Double) -> String) -> String {
        guard series.contains(where: { !$0.values.isEmpty }) else { return noData }
        return series.filter { !$0.values.isEmpty }
            .map { item in
                let sentence = self.series(item.values, format: format)
                return item.name.isEmpty ? sentence : "\(item.name): \(sentence)"
            }
            .joined(separator: ". ")
    }

    /// "8 bars, average 5.2, highest 9 on Mar 4", or "No data".
    static func bars(totals: [Double], labels: [String], format: (Double) -> String) -> String {
        guard let average = ChartMath.mean(totals), let high = totals.max(),
            let index = totals.firstIndex(of: high), index < labels.count
        else { return noData }
        let count = totals.count
        let mean = format(average)
        let top = format(high)
        let label = labels[index]
        return String(localized: "\(count) bars, average \(mean), highest \(top) on \(label)", bundle: .module)
    }

    /// "Most values from 5 to 10, average 7.4", or "No data".
    static func histogram(_ bins: [HistogramBin], average: Double?, format: (Double) -> String) -> String {
        guard let mode = HistogramBin.mode(of: bins), mode.count >= 1 else { return noData }
        let lower = format(mode.lower)
        let upper = format(mode.upper)
        let modeText = String(localized: "Most values from \(lower) to \(upper)", bundle: .module)
        guard let average else { return modeText }
        let mean = format(average)
        return modeText + ", " + String(localized: "average \(mean)", bundle: .module)
    }

    /// "Active on 12 of 28 days, longest streak 4 days".
    static func heatmap(active: Int, total: Int, streak: Int) -> String {
        String(localized: "Active on \(active) of \(total) days, longest streak \(streak) days", bundle: .module)
    }

    /// The text when a chart has nothing to show.
    static var noData: String { String(localized: "No data", bundle: .module) }
}
