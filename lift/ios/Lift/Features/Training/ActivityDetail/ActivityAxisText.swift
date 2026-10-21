import Foundation

/// Axis and read-out text for the activity charts. The server sends every value's own text; these only label chart
/// axes and crosshair read-outs, which it cannot send per tick.
nonisolated enum ActivityAxisText {
    /// "5:05", or "1:02:03" past an hour. Negative or non-finite reads as "0:00".
    static func clock(_ seconds: Double) -> String {
        let total = seconds.isFinite ? max(Int(seconds.rounded()), 0) : 0
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let rest = total % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, rest)
            : String(format: "%d:%02d", minutes, rest)
    }

    /// A stream value with its unit: pace (s/km) as "5:05 /km", everything else as a whole number and its unit.
    static func stream(_ value: Double, unit: String) -> String {
        unit == "/km" ? "\(clock(value)) /km" : "\(Int(value.rounded())) \(unit)"
    }

    /// A speed in m/s as the bars' unit: pace for "/km", km/h otherwise.
    static func speed(_ metersPerSecond: Double, unit: String) -> String {
        guard metersPerSecond > 0, metersPerSecond.isFinite else { return "–" }
        return unit == "/km"
            ? "\(clock(1000 / metersPerSecond)) /km"
            : "\((metersPerSecond * 3.6).formatted(.number.precision(.fractionLength(1)))) km/h"
    }

    /// The analysis x axis: "4.2 km", or the elapsed time as a clock.
    static func axis(_ value: Double, axis: AnalysisAxis) -> String {
        switch axis {
        case .distance: "\(value.formatted(.number.precision(.fractionLength(0...1)))) km"
        case .time: clock(value)
        }
    }

    /// A power-curve duration: "5s", "1m", "20m", "1h".
    static func duration(_ seconds: Double) -> String {
        if seconds < 60 { return "\(Int(seconds))s" }
        if seconds < 3600 { return "\(Int(seconds / 60))m" }
        return "\((seconds / 3600).formatted(.number.precision(.fractionLength(0...1))))h"
    }
}
