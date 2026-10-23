import KoboComponents
import SwiftUI

/// Builds the screens of the coach's read-only pages that other screens link to (lift/APP-API.md, "Links") and hands
/// them their dependencies (DI-1). Each owner swaps its placeholder for its screen.
struct AppAPIRouteScreen: View {
    let route: AppRoute
    let dependencies: AppDependencies
    let router: any Navigating
    /// The tab's toast slot, for the local workout a session link can open.
    let toasts: ToastCenter

    var body: some View {
        switch route {
        case .activity(let id):
            workout(WorkoutDetail.stravaRef(id), seed: dependencies.activitySeeds.seed(for: id))
                .id(route)
        case .liftSession(let sessionID):
            LiftSessionRoute(sessionID: sessionID, dependencies: dependencies, router: router, toasts: toasts)
                .id(route)
        case .liftExercise(let key):
            LiftExerciseRoute(exerciseKey: key, workoutNote: nil, dependencies: dependencies, router: router)
        case .liftWeekly:
            LiftWeeklyRoute(dependencies: dependencies, router: router)
        case .plannedWorkout(let id):
            // The same page as the activity: a workout is one thing, planned and done.
            workout(WorkoutDetail.planRef(id), seed: nil)
                .id(route)
        case .weighIn(let day):
            WeighInRoute(day: day, dependencies: dependencies, router: router)
                .id(route)
        default:
            EmptyView()
        }
    }

    /// The one workout page, for a plan workout or a Strava activity.
    private func workout(_ ref: String, seed: ActivitySeed?) -> some View {
        ActivityDetailScreen(
            viewModel: ActivityDetailViewModel(
                ref: ref,
                seed: seed,
                data: dependencies.appData,
                starter: PlannedSessionStarter(
                    exercises: dependencies.exercises,
                    plans: dependencies.plans,
                    catalog: dependencies.catalog,
                    units: dependencies.units,
                    data: dependencies.appData
                ),
                coachPlan: dependencies.coachPlan,
                router: router,
                tabs: dependencies.tabs,
                now: dependencies.now,
                calendar: dependencies.calendar
            )
        )
    }
}

/// A screen that is not built yet: its title and a plain note.
struct AppRoutePlaceholder: View {
    let title: LocalizedStringKey

    var body: some View {
        EmptyState(title: title, message: "This screen is on its way.") { EmptyStateArt(systemImage: "hammer") }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .screenCanvas()
            .navigationTitle(title)
    }
}
