import SwiftUI

/// Builds the exercise detail screen for a coach `exerciseKey` with its dependencies (DI-1). An `id-<uuid>` key is a
/// library exercise: its media, guide and local history, with the coach's numbers. A `name-…` key has no library entry:
/// the coach's numbers alone. `.exercise(id)` comes here too, so both routes show one screen.
struct LiftExerciseRoute: View {
    let exerciseKey: String
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        ExerciseDetailScreen(
            viewModel: ExerciseDetailViewModel(
                exerciseID: LiftLinks.libraryID(fromKey: exerciseKey),
                exerciseKey: exerciseKey,
                exercises: dependencies.exercises,
                history: dependencies.history,
                catalog: dependencies.catalog,
                data: dependencies.appData,
                router: router,
                now: dependencies.now,
                calendar: dependencies.calendar,
                unit: dependencies.info.unit
            )
        )
        .id(exerciseKey)
    }
}
