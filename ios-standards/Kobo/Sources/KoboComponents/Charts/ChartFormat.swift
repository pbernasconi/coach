import Foundation

/// Default text for chart values, used when a chart is given no formatter.
nonisolated public enum ChartFormat {
    /// The locale's number format with at most one decimal ("1,234.5").
    public static func number(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }

    /// A short month and day ("Mar 4").
    public static func date(_ value: Date) -> String {
        value.formatted(.dateTime.month(.abbreviated).day())
    }
}
