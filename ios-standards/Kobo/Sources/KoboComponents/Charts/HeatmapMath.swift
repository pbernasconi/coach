import Foundation

/// One day of a `KoboHeatmap`: its date and value (zero or less reads as an empty day).
nonisolated public struct HeatmapDay: Equatable, Hashable, Sendable {
    public let date: Date
    public let value: Double

    public init(date: Date, value: Double) {
        self.date = date
        self.value = value
    }
}

/// One cell of the heatmap grid: the day it stands for, its value and its shade level (0 is empty).
nonisolated struct HeatmapCell: Equatable, Hashable, Sendable, Identifiable {
    let date: Date
    let value: Double
    let level: Int
    /// A day after `end` (the rest of the current week): drawn as blank space, not as an empty day.
    let isFuture: Bool

    var id: Date { date }
}

/// Pure heatmap maths: the weeks × days grid, shade levels and the VoiceOver summary numbers.
nonisolated enum HeatmapMath {
    /// `weeks` columns of 7 cells, oldest week first, each column starting on the calendar's first weekday, with the
    /// last column holding `end`. Values on the same day add up; shades scale to the busiest day shown.
    static func grid(
        days: [HeatmapDay],
        weeks: Int,
        end: Date,
        levels: Int,
        calendar: Calendar
    ) -> [[HeatmapCell]] {
        guard weeks > 0, let lastWeek = calendar.dateInterval(of: .weekOfYear, for: end)?.start else { return [] }
        let endDay = calendar.startOfDay(for: end)
        var totals: [Date: Double] = [:]
        for day in days { totals[calendar.startOfDay(for: day.date), default: 0] += day.value }
        let dates: [[Date]] = (0..<weeks).map { column in
            let weekStart = calendar.date(byAdding: .weekOfYear, value: column - (weeks - 1), to: lastWeek) ?? lastWeek
            return (0..<7).map { calendar.date(byAdding: .day, value: $0, to: weekStart) ?? weekStart }
        }
        // Shades scale to the busiest day shown, so an old outlier outside the grid never washes it out.
        let top = dates.joined().compactMap { totals[calendar.startOfDay(for: $0)] }.max() ?? 0
        return dates.map { week in
            week.map { date in
                let value = totals[calendar.startOfDay(for: date)] ?? 0
                let level = self.level(value, max: top, levels: levels)
                return HeatmapCell(date: date, value: value, level: level, isFuture: date > endDay)
            }
        }
    }

    /// The shade of `value` on a scale of `levels` steps up to `max`: 0 for nothing, else 1...levels.
    static func level(_ value: Double, max top: Double, levels: Int) -> Int {
        guard value > 0, top > 0, levels > 0 else { return 0 }
        return Swift.min(Swift.max(Int((value / top * Double(levels)).rounded(.up)), 1), levels)
    }

    /// How many shown days had a value, out of how many have passed.
    static func activeDays(in grid: [[HeatmapCell]]) -> (active: Int, total: Int) {
        let past = grid.joined().filter { !$0.isFuture }
        return (past.count { $0.value > 0 }, past.count)
    }

    /// The longest run of days in a row with a value.
    static func longestStreak(in grid: [[HeatmapCell]]) -> Int {
        var best = 0
        var run = 0
        for cell in grid.joined() where !cell.isFuture {
            run = cell.value > 0 ? run + 1 : 0
            best = Swift.max(best, run)
        }
        return best
    }
}
