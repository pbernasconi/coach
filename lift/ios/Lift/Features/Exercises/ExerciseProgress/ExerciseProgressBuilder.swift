import Foundation
import LiftCore

/// Builds the progress chart from an exercise's points (`ExerciseProgress`): the range's sessions, the axis, the
/// headline and the VoiceOver summary. Numbers and plain labels only.
nonisolated struct ExerciseProgressBuilder: Sendable {
    let days: DayCalendar
    let unit: WeightUnit

    /// `.empty` when there is nothing to chart at all; otherwise the chart for `range` ending on `today`.
    func chart(
        _ points: [ProgressPoint],
        range: ProgressRange,
        selectedID: UUID?,
        today: LocalDay
    ) -> Loadable<ExerciseProgressChart> {
        guard !points.isEmpty else { return .empty }
        let summary = ExerciseProgress.summary(points, range: range, today: today)
        let shown = summary.points.compactMap(chartPoint)
        let selected = summary.points.first { $0.id == selectedID }
        return .loaded(
            ExerciseProgressChart(
                points: shown,
                domain: domain(range: range, first: summary.points.first?.day ?? today, today: today),
                headline: selected.map(headline(selected:)) ?? headline(summary: summary),
                selectedID: selected?.id,
                emptyMessage: shown.isEmpty ? ExerciseProgressText.noSessions(in: range) : nil,
                accessibilitySummary: accessibilitySummary(summary, range: range)
            )
        )
    }

    /// The session in the range nearest to `date`, for chart selection.
    func nearestID(to date: Date, in points: [ProgressPoint], range: ProgressRange, today: LocalDay) -> UUID? {
        ExerciseProgress.summary(points, range: range, today: today).points
            .compactMap(chartPoint)
            .min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }?
            .id
    }

    private func chartPoint(_ point: ProgressPoint) -> ProgressChartPoint? {
        guard let date = days.date(of: point.day) else { return nil }
        return ProgressChartPoint(
            id: point.id,
            date: date,
            estimate: point.estimate.map(rounded)?.value,
            heaviest: point.heaviest?.converted(to: unit).value
        )
    }

    /// From the range's first day (or the first session, for All) to today, never empty.
    private func domain(range: ProgressRange, first: LocalDay, today: LocalDay) -> ClosedRange<Date> {
        let start = min(range.firstDay(today: today) ?? first, today.adding(days: -1))
        let end = days.date(of: today) ?? Date(timeIntervalSince1970: 0)
        return (days.date(of: start) ?? end)...end
    }

    private func headline(summary: ProgressSummary) -> ProgressHeadline {
        if let best = summary.best?.estimate {
            return ProgressHeadline(
                label: String(localized: "Best est. 1RM"),
                value: WorkoutText.weight(rounded(best)),
                detail: change(summary)
            )
        }
        let heaviest = summary.points.compactMap(\.heaviest).max { $0.value < $1.value }
        return ProgressHeadline(
            label: String(localized: "Heaviest set"),
            value: heaviest.map(WorkoutText.weight) ?? "–",
            detail: nil
        )
    }

    private func headline(selected point: ProgressPoint) -> ProgressHeadline {
        let day = days.shortTitle(of: point.day)
        let top = WorkoutText.values(reps: point.topSet.reps, weight: point.topSet.weight)
        if let estimate = point.estimate {
            return ProgressHeadline(
                label: String(localized: "\(day) · Est. 1RM"),
                value: WorkoutText.weight(rounded(estimate)),
                detail: top.map { String(localized: "Top set \($0)") }
            )
        }
        return ProgressHeadline(
            label: String(localized: "\(day) · Heaviest set"),
            value: point.heaviest.map(WorkoutText.weight) ?? "–",
            detail: top.map { String(localized: "Top set \($0)") }
        )
    }

    /// "+6.5 kg since Jul 14".
    private func change(_ summary: ProgressSummary) -> String? {
        guard let change = summary.change, let since = summary.since else { return nil }
        return ExerciseProgressText.change(rounded(change), since: days.monthDayTitle(of: since))
    }

    private func accessibilitySummary(_ summary: ProgressSummary, range: ProgressRange) -> String {
        let sessions = ExerciseProgressText.sessions(summary.points.count, in: range)
        guard let best = summary.best, let estimate = best.estimate else { return sessions }
        let bestText = String(
            localized:
                "Best estimated 1RM \(WorkoutText.weight(rounded(estimate))) on \(days.shortTitle(of: best.day))."
        )
        return [sessions, bestText, change(summary)].compactMap(\.self).joined(separator: " ")
    }

    /// In the chart's unit, to the half.
    private func rounded(_ weight: Weight) -> Weight {
        weight.converted(to: unit).rounded(toStep: 0.5)
    }
}
