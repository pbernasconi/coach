import Foundation
import LiftCore

/// Builds the History tab's Progress view from the sessions of the last weeks and the exercise library
/// (`WeeklyVolume`): the chosen week's hard sets per muscle, the 8-week trend and a muscle's exercises. Numbers and
/// plain labels only.
nonisolated struct HistoryVolumeBuilder: Sendable {
    let days: DayCalendar

    /// The first day of each of the last `HistoryState.weekCount` weeks through `today`, oldest first.
    func weekStarts(today: LocalDay) -> [LocalDay] {
        let current = days.weekStart(of: today)
        return (0..<HistoryState.weekCount).reversed().map { current.adding(days: -7 * $0) }
    }

    /// `.empty` when no hard set was logged in any of the weeks; otherwise the progress for `selected` (a week start,
    /// or this week when it is nil or out of range).
    func progress(
        sessions: [Session],
        library: [Exercise],
        selected: LocalDay?,
        today: LocalDay
    ) -> Loadable<VolumeProgress> {
        let starts = weekStarts(today: today)
        let weeks = WeeklyVolume.weeks(sessions: sessions, library: library, starts: starts)
        guard weeks.contains(where: { $0.hardSets > 0 }), let current = weeks.last else { return .empty }
        let index = weeks.firstIndex { $0.start == selected } ?? weeks.count - 1
        let week = weeks[index]
        let most = week.muscles.map(\.hardSets).max() ?? 0
        let trend = weeks.map { trendBar($0, selected: week.start) }
        return .loaded(
            VolumeProgress(
                week: volumeWeek(week, current: current.start),
                trend: trend,
                previousWeek: index > 0 ? weeks[index - 1].start : nil,
                nextWeek: index < weeks.count - 1 ? weeks[index + 1].start : nil,
                scaleMax: max(WeeklyVolume.targetSets.upperBound + 4, most.rounded(.up)),
                trendSummary: HistoryVolumeText.trendSummary(trend, days: days)
            )
        )
    }

    /// The week whose seven days hold `date`, among the trend's weeks.
    func week(containing date: Date, today: LocalDay) -> LocalDay? {
        let day = days.day(of: date)
        return weekStarts(today: today).last { $0 <= day && day < $0.adding(days: 7) }
    }

    /// The exercises behind `muscle` in the week starting on `start`.
    func detail(
        for muscle: Muscle,
        week start: LocalDay,
        sessions: [Session],
        library: [Exercise],
        today: LocalDay
    ) -> MuscleDetail {
        let week = sessions.filter { $0.date >= start && $0.date < start.adding(days: 7) }
        let total = WeeklyVolume.volume(sessions: week, library: library).first { $0.muscle == muscle }?.hardSets ?? 0
        let current = days.weekStart(of: today)
        let rows = WeeklyVolume.contributions(to: muscle, sessions: week, library: library).map { item in
            MuscleDetailRow(
                id: item.exerciseID,
                name: item.name,
                detail: HistoryVolumeText.contribution(hardSets: item.hardSets, isPrimary: item.isPrimary),
                value: HistoryVolumeText.sets(item.credit)
            )
        }
        return MuscleDetail(
            id: muscle,
            title: ExerciseText.muscle(muscle),
            subtitle: "\(weekTitle(start, current: current)) · \(HistoryVolumeText.hardSets(total))",
            rows: rows
        )
    }

    private func volumeWeek(_ week: WeekVolume, current: LocalDay) -> VolumeWeek {
        VolumeWeek(
            id: week.start,
            title: weekTitle(week.start, current: current),
            total: HistoryVolumeText.hardSets(Double(week.hardSets)),
            muscles: week.muscles.map { volume in
                VolumeMuscleRow(
                    id: volume.muscle,
                    name: ExerciseText.muscle(volume.muscle),
                    sets: volume.hardSets,
                    value: HistoryVolumeText.sets(volume.hardSets),
                    status: volume.status,
                    accessibilityValue: HistoryVolumeText.accessibilityValue(volume)
                )
            }
        )
    }

    private func trendBar(_ week: WeekVolume, selected: LocalDay) -> VolumeTrendBar {
        VolumeTrendBar(
            id: week.start,
            date: days.date(of: week.start) ?? Date(timeIntervalSince1970: 0),
            sets: week.hardSets,
            isSelected: week.start == selected
        )
    }

    /// "This week", "Last week", or "Week of Oct 4".
    private func weekTitle(_ start: LocalDay, current: LocalDay) -> String {
        if start == current { return String(localized: "This week") }
        if start == current.adding(days: -7) { return String(localized: "Last week") }
        return days.weekTitle(start: start)
    }
}
