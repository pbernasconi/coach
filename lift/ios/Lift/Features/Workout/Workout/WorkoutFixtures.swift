#if DEBUG
    import Foundation
    import LiftCore
    import LiftStore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension WorkoutState {
        private static func set(
            _ number: UInt8,
            _ title: String,
            _ target: String,
            actual: String? = nil,
            status: SetStatus = .planned
        ) -> WorkoutSetItem {
            WorkoutSetItem(id: .fixture(number), title: title, target: target, actual: actual, status: status)
        }

        private static let squat = WorkoutExercise(
            id: .fixture(20),
            name: "Back squat",
            target: "3 × 5 @ 100 kg",
            warmUp: "Warm-up: 20×10 · 50×5 · 70×3 · 85×1 kg",
            plates: "Per side: 25 + 15 · 20 kg bar",
            progression: nil,
            sets: [
                set(21, "Set 1", "5 @ 100 kg", actual: "5 @ 100 kg", status: .done),
                set(22, "Set 2", "5 @ 100 kg", actual: "6 @ 100 kg"),
                set(23, "Set 3", "5 @ 100 kg"),
            ],
            libraryID: ExerciseLibrary.seedID(1)
        )

        private static let romanian = WorkoutExercise(
            id: .fixture(30),
            name: "Romanian deadlift",
            target: "3 × 8 @ 60 kg",
            warmUp: "Warm-up: 20×10 · 30×5 · 42.5×3 · 50×1 kg",
            plates: "Per side: 20 · 20 kg bar",
            progression: "Next time: 8 @ 62.5 kg",
            sets: [
                set(31, "Set 1", "8 @ 60 kg", actual: "8 @ 60 kg", status: .done),
                set(32, "Set 2", "8 @ 60 kg", actual: "8 @ 60 kg", status: .done),
                set(33, "Set 3", "8 @ 60 kg", status: .skipped),
            ],
            libraryID: ExerciseLibrary.seedID(3)
        )

        private static let curl = WorkoutExercise(
            id: .fixture(40),
            name: "Dumbbell curl",
            target: "2 × 10 @ 14 kg",
            warmUp: nil,
            plates: nil,
            progression: nil,
            sets: [set(41, "Set 1", "10 @ 14 kg"), set(42, "Set 2", "10 @ 14 kg")]
        )

        private static let overview = WorkoutOverview(
            title: "Lower A",
            dayTitle: "Thursday, 5 March",
            loggedSets: 3,
            totalSets: 8,
            exercises: [squat, romanian, curl]
        )

        static let fixtureDefault = WorkoutState(workout: .loaded(overview))
        static let fixtureResting = WorkoutState(
            workout: .loaded(overview),
            rest: RestTimer(run: 1, seconds: 90).ticked()
        )
        static let fixtureEditing = WorkoutState(
            workout: .loaded(overview),
            editor: SetEditor(
                id: .fixture(22),
                title: "Set 2 · Back squat",
                unit: .kg,
                step: 2.5,
                weight: 100,
                reps: 6,
                savedWeight: 100,
                savedReps: 5
            )
        )
        static let fixtureLoading = WorkoutState(workout: .loading)
        static let fixtureEmpty = WorkoutState(workout: .empty)
        static let fixtureFailed = WorkoutState(workout: .failed(.unknown))
        static let fixtureLongText = WorkoutState(
            workout: .loaded(
                WorkoutOverview(
                    title: "Full body with extra accessory work for the upper back and shoulders",
                    dayTitle: "Wednesday, 30 September",
                    loggedSets: 0,
                    totalSets: 2,
                    exercises: [
                        WorkoutExercise(
                            id: .fixture(50),
                            name: "Single-arm dumbbell row with a pause at the top",
                            target: "2 × 10–12 @ 32.5 kg",
                            warmUp: nil,
                            plates: nil,
                            progression: "Next time: same weight, 11 reps",
                            sets: [set(51, "Set 1", "10–12 @ 32.5 kg"), set(52, "Set 2", "10–12 @ 32.5 kg")]
                        )
                    ]
                )
            ),
            rest: RestTimer(run: 1, seconds: 125)
        )
    }
#endif
