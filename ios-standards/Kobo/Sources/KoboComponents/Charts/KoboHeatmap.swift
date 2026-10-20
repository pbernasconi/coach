import Foundation
import KoboTokens
import SwiftUI

/// A consistency grid: one column per week (oldest on the leading side), one row per weekday, each day shaded by its
/// value in steps of the accent, with a "Less … More" legend. Days still to come in the current week stay blank.
/// VoiceOver reads the label and "Active on 12 of 28 days, longest streak 4 days".
///
///     KoboHeatmap(days: minutesPerDay, weeks: 12, end: today, accessibilityLabel: "Daily activity")
public struct KoboHeatmap: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var legendSwatch = Space.md
    private let days: [HeatmapDay]
    private let weeks: Int
    private let end: Date
    private let levels: Int
    private let calendar: Calendar
    private var label: Text

    /// - Parameters:
    ///   - weeks: how many week columns to show, ending with the week that holds `end`.
    ///   - end: the last day with data (today); pass it in, the grid never reads the clock.
    ///   - levels: how many shades above empty.
    ///   - calendar: sets the first weekday and day boundaries.
    public init(
        days: [HeatmapDay],
        weeks: Int = 12,
        end: Date,
        levels: Int = 4,
        calendar: Calendar = .current,
        accessibilityLabel: LocalizedStringKey
    ) {
        self.days = days
        self.weeks = max(weeks, 1)
        self.end = end
        self.levels = max(levels, 1)
        self.calendar = calendar
        self.label = Text(accessibilityLabel)
    }

    /// A heatmap whose accessibility label is shown as is (it names user data).
    public init(
        days: [HeatmapDay],
        weeks: Int = 12,
        end: Date,
        levels: Int = 4,
        calendar: Calendar = .current,
        verbatimAccessibilityLabel: String
    ) {
        self.init(days: days, weeks: weeks, end: end, levels: levels, calendar: calendar, accessibilityLabel: "")
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        let grid = HeatmapMath.grid(days: days, weeks: weeks, end: end, levels: levels, calendar: calendar)
        let active = HeatmapMath.activeDays(in: grid)
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .top, spacing: gap) {
                if !dynamicTypeSize.isAccessibilitySize {
                    weekdayLabels
                }
                ForEach(Array(grid.enumerated()), id: \.offset) { _, week in
                    VStack(spacing: gap) {
                        ForEach(week) { cell in square(cell) }
                    }
                }
            }
            legend
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(
            Text(
                verbatim: ChartSpeech.heatmap(
                    active: active.active,
                    total: active.total,
                    streak: HeatmapMath.longestStreak(in: grid)
                )
            )
        )
    }

    private var gap: CGFloat { weeks > 20 ? Space.xxs : Space.xs }

    private func square(_ cell: HeatmapCell) -> some View {
        RoundedRectangle(cornerRadius: Radius.xs / 2, style: .continuous)
            .fill(cell.isFuture ? Color.clear : shade(cell.level))
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: .infinity)
    }

    private func shade(_ level: Int) -> Color {
        guard level > 0 else { return theme.palette.surfaceSunken }
        return theme.palette.accent.opacity(0.25 + 0.75 * Double(level) / Double(levels))
    }

    /// Every other weekday's initial, on the rows they name.
    private var weekdayLabels: some View {
        let symbols = calendar.veryShortWeekdaySymbols
        return VStack(alignment: .leading, spacing: gap) {
            ForEach(Array((0..<7).enumerated()), id: \.offset) { _, row in
                Text(verbatim: row % 2 == 1 ? symbols[(row + calendar.firstWeekday - 1) % 7] : " ")
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .frame(maxHeight: .infinity)
            }
        }
        .fixedSize(horizontal: true, vertical: false)
    }

    private var legend: some View {
        HStack(spacing: Space.xs) {
            Text("Less", bundle: .module)
            ForEach(Array((0...levels).enumerated()), id: \.offset) { _, level in
                RoundedRectangle(cornerRadius: Radius.xs / 2, style: .continuous)
                    .fill(shade(level))
                    .frame(width: legendSwatch, height: legendSwatch)
            }
            Text("More", bundle: .module)
        }
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}

private struct KoboHeatmapPreview: View {
    @Environment(\.koboTheme) private var theme
    private let end = Date(timeIntervalSinceReferenceDate: 783_000_000)

    var body: some View {
        KoboHeatmap(days: sample, weeks: 16, end: end, accessibilityLabel: "Daily activity")
            .padding()
            .background(theme.palette.canvas)
    }

    private var sample: [HeatmapDay] {
        (0..<110).compactMap { offset in
            let value = Double((offset * 37) % 90) - 20
            guard value > 0 else { return nil }
            return HeatmapDay(date: end.addingTimeInterval(-Double(offset) * 86_400), value: value)
        }
    }
}

#if DEBUG
    #Preview("Heatmap") { KoboHeatmapPreview() }
    #Preview("Heatmap, dark") { KoboHeatmapPreview().preferredColorScheme(.dark) }
    #Preview("Heatmap, AX3") { KoboHeatmapPreview().dynamicTypeSize(.accessibility3) }
#endif
