#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension WorkoutSummaryState {
        static let fixtureOverview = WorkoutSummaryOverview(
            title: "Lower A",
            dayTitle: "Thursday, 5 March",
            duration: "52 min",
            sets: "8",
            volume: "4,370",
            unit: "kg",
            bests: [
                WorkoutBestItem(
                    id: "squat-e1rm",
                    exercise: "Back squat",
                    detail: "Estimated 1RM · was 98 kg",
                    value: "102.1 kg"
                ),
                WorkoutBestItem(
                    id: "squat-weight",
                    exercise: "Back squat",
                    detail: "Heaviest set · was 85 kg",
                    value: "87.5 kg"
                ),
            ]
        )

        static let fixtureDefault = WorkoutSummaryState(summary: .loaded(fixtureOverview))
        static let fixtureLoading = WorkoutSummaryState(summary: .loading)
        static let fixtureEmpty = WorkoutSummaryState(summary: .empty)
        static let fixtureFailed = WorkoutSummaryState(summary: .failed(.unknown))
        static let fixtureNoBests: WorkoutSummaryState = {
            var overview = fixtureOverview
            overview.bests = []
            overview.duration = nil
            return WorkoutSummaryState(summary: .loaded(overview))
        }()
        static let fixtureLongText: WorkoutSummaryState = {
            var overview = fixtureOverview
            overview.title = "Full body with a long name for the heavy week"
            overview.bests[0].exercise = "Single-arm half-kneeling landmine press with a pause at the top"
            return WorkoutSummaryState(summary: .loaded(overview))
        }()
    }
#endif
