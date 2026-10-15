import KoboComponents
import SwiftUI

/// Builds the screen for a pushed route and hands it the dependencies it needs (DI-1).
struct RouteScreen: View {
    let route: AppRoute
    let dependencies: AppDependencies
    let router: any Navigating
    /// The tab's toast slot, which outlives a pushed page (the workout's "Workout discarded" with Undo).
    let toasts: ToastCenter

    var body: some View {
        switch route {
        case .workout(let sessionID):
            WorkoutScreen(
                viewModel: WorkoutViewModel(
                    sessionID: sessionID,
                    sessions: dependencies.sessions,
                    sets: dependencies.sets,
                    templates: dependencies.templates,
                    router: router,
                    clock: dependencies.clock,
                    restActivity: dependencies.restActivity,
                    catalog: dependencies.catalog,
                    history: dependencies.history,
                    health: dependencies.health,
                    gym: dependencies.gym,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                ),
                toasts: toasts
            )
            .id(route)
        case .exercise(let exerciseID):
            ExerciseDetailScreen(
                viewModel: ExerciseDetailViewModel(
                    exerciseID: exerciseID,
                    exercises: dependencies.exercises,
                    history: dependencies.history,
                    catalog: dependencies.catalog,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    unit: dependencies.info.unit
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
                    router: router,
                    history: dependencies.history,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    unit: dependencies.info.unit
                )
            )
            .id(route)
        case .acknowledgements:
            AcknowledgementsScreen(viewModel: AcknowledgementsViewModel(items: Acknowledgement.bundled))
        case .templates, .template, .exercisePicker, .workoutSummary:
            PlanRouteScreen(route: route, dependencies: dependencies, router: router)
        }
    }
}
