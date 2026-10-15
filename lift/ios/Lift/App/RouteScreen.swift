import SwiftUI

/// Builds the screen for a pushed route and hands it the dependencies it needs (DI-1).
struct RouteScreen: View {
    let route: AppRoute
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        switch route {
        case .workout(let sessionID):
            WorkoutScreen(
                viewModel: WorkoutViewModel(
                    sessionID: sessionID,
                    sessions: dependencies.sessions,
                    sets: dependencies.sets,
                    router: router,
                    clock: dependencies.clock,
                    restActivity: dependencies.restActivity,
                    catalog: dependencies.catalog,
                    history: dependencies.history,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                )
            )
            .id(route)
        case .exercise(let exerciseID):
            ExerciseDetailScreen(
                viewModel: ExerciseDetailViewModel(
                    exerciseID: exerciseID,
                    exercises: dependencies.exercises,
                    history: dependencies.history,
                    catalog: dependencies.catalog,
                    calendar: dependencies.calendar
                )
            )
            .id(route)
        case .catalog:
            CatalogScreen(
                viewModel: CatalogViewModel(
                    catalog: dependencies.catalog,
                    exercises: dependencies.exercises,
                    router: router
                )
            )
        case .catalogExercise(let catalogID):
            CatalogDetailScreen(
                viewModel: CatalogDetailViewModel(
                    catalogID: catalogID,
                    catalog: dependencies.catalog,
                    exercises: dependencies.exercises,
                    router: router
                )
            )
            .id(route)
        case .acknowledgements:
            AcknowledgementsScreen(viewModel: AcknowledgementsViewModel(items: Acknowledgement.bundled))
        }
    }
}
