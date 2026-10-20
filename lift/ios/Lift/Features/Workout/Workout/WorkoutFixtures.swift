#if DEBUG
    import Foundation
    import LiftCore
    import LiftStore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension WorkoutState {
        /// A working set row: "Set 2", target "5 @ 87.5 kg", pills "87.5" and "5", and last time's values.
        private static func set(
            _ id: UInt8,
            _ number: Int,
            reps: String,
            kg weight: String,
            previous: String? = nil,
            status: SetStatus = .planned,
            note: String? = nil,
            rpe: String? = nil
        ) -> WorkoutSetItem {
            WorkoutSetItem(
                id: .fixture(id),
                title: "Set \(number)",
                target: "\(reps) @ \(weight) kg",
                actual: status == .done ? "\(reps) @ \(weight) kg" : nil,
                status: status,
                badge: "\(number)",
                weight: weight,
                reps: reps,
                previous: previous,
                note: note,
                rpe: rpe
            )
        }

        private static let squat = WorkoutExercise(
            id: .fixture(20),
            name: "Back squat",
            target: "3 × 5 @ 87.5 kg",
            warmUp: "Warm-up: 20×10 · 42.5×5 · 60×3 · 75×1 kg",
            plates: "Per side: 25 + 5 + 2.5 + 1.25 · 20 kg bar",
            progression: nil,
            sets: [
                WorkoutSetItem(
                    id: .fixture(24),
                    title: "Warm-up 1",
                    target: "5 @ 60 kg",
                    actual: nil,
                    status: .done,
                    badge: "W",
                    weight: "60",
                    reps: "5",
                    previous: "5 × 60"
                ),
                set(
                    21,
                    1,
                    reps: "5",
                    kg: "87.5",
                    previous: "5 × 85",
                    status: .done,
                    note: "Paused at the bottom",
                    rpe: "RPE 8"
                ),
                set(22, 2, reps: "6", kg: "87.5", previous: "5 × 85"),
                set(23, 3, reps: "5", kg: "87.5", previous: "4 × 85"),
            ],
            libraryID: ExerciseLibrary.seedID(1),
            catalogID: "0043"
        )

        private static let romanian = WorkoutExercise(
            id: .fixture(30),
            name: "Romanian deadlift",
            target: "3 × 8 @ 65 kg",
            warmUp: "Warm-up: 20×10 · 32.5×5 · 45×3 · 55×1 kg",
            plates: "Per side: 20 + 2.5 · 20 kg bar",
            progression: "Next time: 8 @ 67.5 kg",
            sets: [
                set(31, 1, reps: "8", kg: "65", previous: "8 × 62.5", status: .done),
                set(32, 2, reps: "8", kg: "65", previous: "8 × 62.5", status: .done),
                set(33, 3, reps: "8", kg: "65", previous: "7 × 62.5", status: .skipped),
            ],
            libraryID: ExerciseLibrary.seedID(3),
            note: "Straps on the last set"
        )

        private static let curl = WorkoutExercise(
            id: .fixture(40),
            name: "Dumbbell curl",
            target: "2 × 10 @ 14 kg",
            warmUp: nil,
            plates: nil,
            progression: nil,
            sets: [set(41, 1, reps: "10", kg: "14"), set(42, 2, reps: "10", kg: "14")]
        )

        private static let overview = WorkoutOverview(
            title: "Lower A",
            dayTitle: "Thursday, 5 March",
            loggedSets: 4,
            totalSets: 9,
            exercises: [squat, romanian, curl],
            note: "Short on time, skipped the lunges",
            warmUpNote: "5 min rower"
        )

        static let fixtureDefault = WorkoutState(
            workout: .loaded(overview),
            thumbnails: ["0043": MediaPreviewData.still]
        )
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
                weight: 90,
                reps: 6,
                savedWeight: 87.5,
                savedReps: 6,
                lastTime: "Last time 5 × 85 kg · Thu, Feb 26",
                laterSets: 1,
                rpe: 8.5,
                note: "Belt on"
            )
        )
        static let fixtureNoteEditing = WorkoutState(
            workout: .loaded(overview),
            noteEditor: NoteEditor(
                target: .session(.fixture(1)),
                title: "Workout note",
                text: "Short on time, skipped the lunges",
                savedText: "Short on time, skipped the lunges"
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
                            sets: [
                                set(51, 1, reps: "10–12", kg: "32.5", previous: "12 × 30"),
                                set(52, 2, reps: "10–12", kg: "32.5", previous: "11 × 30"),
                            ]
                        )
                    ]
                )
            ),
            rest: RestTimer(run: 1, seconds: 125)
        )
    }
#endif
