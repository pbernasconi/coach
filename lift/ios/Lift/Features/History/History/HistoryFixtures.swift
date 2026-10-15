#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension HistoryState {
        private static let thisWeek = HistoryWeek(
            id: LocalDay(year: 2026, month: 3, day: 2),
            title: "Week of 2 Mar",
            sessions: [
                HistorySession(summary: SessionSummary.fixtureUpper, dayTitle: "Thu 5 Mar"),
                HistorySession(summary: SessionSummary.fixtureLower, dayTitle: "Tue 3 Mar"),
            ]
        )

        private static let lastWeek = HistoryWeek(
            id: LocalDay(year: 2026, month: 2, day: 23),
            title: "Week of 23 Feb",
            sessions: [HistorySession(summary: SessionSummary.fixtureLower, dayTitle: "Wed 25 Feb")]
        )

        /// Made-up hard sets per muscle, in `Muscle.allCases` order.
        private static let muscleSets: [Double] = [12, 14.5, 9, 4.5, 6, 11, 8.5, 16, 0, 3, 2]

        private static let volumeWeek = VolumeWeek(
            id: LocalDay(year: 2026, month: 3, day: 2),
            title: "This week",
            total: "52 hard sets",
            muscles: zip(Muscle.allCases, muscleSets).map { muscle, sets in
                let status = WeeklyVolume.status(forHardSets: sets)
                return VolumeMuscleRow(
                    id: muscle,
                    name: ExerciseText.muscle(muscle),
                    sets: sets,
                    value: HistoryVolumeText.sets(sets),
                    status: status,
                    accessibilityValue: HistoryVolumeText.sets(sets)
                )
            }
        )

        private static let trend: [VolumeTrendBar] = [38, 44, 41, 47, 30, 49, 52, 52].enumerated().map { index, sets in
            let start = LocalDay(year: 2026, month: 3, day: 2).adding(days: -7 * (7 - index))
            return VolumeTrendBar(
                id: start,
                date: start.startDate(in: Calendar(identifier: .gregorian)) ?? Date(timeIntervalSince1970: 0),
                sets: sets,
                isSelected: index == 7
            )
        }

        private static let volume = VolumeProgress(
            week: volumeWeek,
            trend: trend,
            previousWeek: LocalDay(year: 2026, month: 2, day: 23),
            nextWeek: nil,
            scaleMax: 24,
            trendSummary: "Made-up weekly hard sets."
        )

        static let fixtureDefault = HistoryState(weeks: .loaded([thisWeek, lastWeek]))
        static let fixtureProgress = HistoryState(
            segment: .progress,
            weeks: .loaded([thisWeek, lastWeek]),
            volume: .loaded(volume)
        )
        static let fixtureProgressMuscle = HistoryState(
            segment: .progress,
            weeks: .loaded([thisWeek, lastWeek]),
            volume: .loaded(volume),
            muscleDetail: MuscleDetail(
                id: .quads,
                title: "Quads",
                subtitle: "This week · 11 hard sets",
                rows: [
                    MuscleDetailRow(id: .fixture(1), name: "Back squat", detail: "Primary · 6 sets", value: "6"),
                    MuscleDetailRow(
                        id: .fixture(2),
                        name: "Bulgarian split squat",
                        detail: "Primary · 4 sets",
                        value: "4"
                    ),
                    MuscleDetailRow(
                        id: .fixture(3),
                        name: "Deadlift",
                        detail: "Secondary · 2 sets at half credit",
                        value: "1"
                    ),
                ]
            )
        )
        static let fixtureProgressEmpty = HistoryState(segment: .progress, weeks: .empty, volume: .empty)
        static let fixtureLoading = HistoryState(weeks: .loading)
        static let fixtureEmpty = HistoryState(weeks: .empty)
        static let fixtureFailed = HistoryState(weeks: .failed(.unknown))
        static let fixtureLongText = HistoryState(
            weeks: .loaded([
                HistoryWeek(
                    id: LocalDay(year: 2026, month: 3, day: 2),
                    title: "Week of 2 Mar",
                    sessions: [HistorySession(summary: SessionSummary.fixtureLongTitle, dayTitle: "Thu 5 Mar")]
                )
            ])
        )
    }
#endif
