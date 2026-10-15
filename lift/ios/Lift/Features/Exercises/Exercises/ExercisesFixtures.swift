#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension ExercisesState {
        private static let library = ExerciseLibrary.seed.map { ExerciseItem(exercise: $0) }

        static let fixtureDefault = ExercisesState(exercises: .loaded(library))
        static let fixtureLoading = ExercisesState(exercises: .loading)
        static let fixtureEmpty = ExercisesState(exercises: .empty)
        static let fixtureFailed = ExercisesState(exercises: .failed(.unknown))
        static let fixtureSearch = ExercisesState(query: "squat", exercises: .loaded(library))
        static let fixtureNoMatches = ExercisesState(query: "zercher", exercises: .loaded(library))
        static let fixtureLongText = ExercisesState(
            exercises: .loaded([
                ExerciseItem(
                    id: .fixture(1),
                    name: "Single-arm half-kneeling landmine press with a pause at the top",
                    aliases: [],
                    detail: "Barbell · Shoulders, Triceps, Chest"
                )
            ])
        )
    }
#endif
