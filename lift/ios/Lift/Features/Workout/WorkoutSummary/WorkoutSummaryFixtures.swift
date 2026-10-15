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
                    id: "squat",
                    exercise: "Back squat",
                    detail: "87.5 kg × 5 · est. 1RM 102 kg (was 98)",
                    value: "87.5 kg"
                ),
                WorkoutBestItem(
                    id: "rdl",
                    exercise: "Romanian deadlift",
                    detail: "65 kg × 10 · est. 1RM 86.5 kg (was 84)",
                    value: "86.5 kg"
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
