import SwiftUI

/// Builds the planning screens (templates, the template editor, the exercise picker) and the workout summary, and
/// hands them the dependencies they need (DI-1). `RouteScreen` sends these routes here.
struct PlanRouteScreen: View {
    let route: AppRoute
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        switch route {
        case .templates:
            TemplatesScreen(viewModel: TemplatesViewModel(templates: dependencies.templates, router: router))
        case .template(let templateID):
            TemplateEditorScreen(
                viewModel: TemplateEditorViewModel(
                    templateID: templateID,
                    templates: dependencies.templates,
                    router: router,
                    unit: dependencies.info.unit
                )
            )
            .id(route)
        case .exercisePicker(let target):
            ExercisePickerScreen(
                viewModel: ExercisePickerViewModel(
                    target: target,
                    exercises: dependencies.exercises,
                    catalog: dependencies.catalog,
                    templates: dependencies.templates,
                    plans: dependencies.plans,
                    router: router
                )
            )
            .id(route)
        case .workoutSummary(let sessionID):
            WorkoutSummaryScreen(
                viewModel: WorkoutSummaryViewModel(
                    sessionID: sessionID,
                    sessions: dependencies.sessions,
                    history: dependencies.history,
                    health: dependencies.health,
                    router: router,
                    calendar: dependencies.calendar
                )
            )
            .id(route)
        case .workout, .exercise, .catalog, .catalogExercise, .acknowledgements, .plates, .activity, .liftSession,
            .liftExercise, .liftWeekly, .weighIn:
            EmptyView()  // built by RouteScreen
        }
    }
}
