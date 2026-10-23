import KoboComponents
import LiftStore
import SwiftUI

/// Where a session link leads (lift/APP-API.md, "Links"): the local workout for a session this iPhone has that is not
/// finished, otherwise the coach's read-only page. `local` is this iPhone's finished copy, which the page falls back to
/// when the coach cannot show it.
nonisolated enum LiftSessionDestination: Equatable, Sendable {
    case workout(UUID)
    case coach(local: UUID?)
}

/// Decides `LiftSessionDestination` from the local store: one read of the session, nothing else.
nonisolated struct LiftSessionResolver: Sendable {
    let sessions: any SessionRepository

    func destination(for sessionID: String) async -> LiftSessionDestination {
        guard let id = UUID(uuidString: sessionID) else { return .coach(local: nil) }
        for await detail in sessions.observeSession(id: id) {
            guard let detail else { return .coach(local: nil) }
            return detail.session.finishedAt == nil ? .workout(id) : .coach(local: id)
        }
        return .coach(local: nil)
    }
}

/// Builds the screen a session link opens and hands it its dependencies (DI-1): the local workout (as `RouteScreen`'s
/// `.workout`) or `LiftSessionScreen`, once the local store has answered.
struct LiftSessionRoute: View {
    let sessionID: String
    let dependencies: AppDependencies
    let router: any Navigating
    let toasts: ToastCenter
    @State private var destination: LiftSessionDestination?

    var body: some View {
        content
            .task(id: sessionID) {
                destination = await LiftSessionResolver(sessions: dependencies.sessions).destination(for: sessionID)
            }
    }

    @ViewBuilder private var content: some View {
        switch destination {
        case nil:
            LoadingState()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .screenCanvas()
        case .workout(let id):
            WorkoutScreen(
                viewModel: WorkoutViewModel(
                    sessionID: id,
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
                    preferences: dependencies.workoutPreferences,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                ),
                toasts: toasts
            )
        case .coach(let local):
            LiftSessionScreen(
                viewModel: LiftSessionViewModel(
                    sessionID: sessionID,
                    localSessionID: local,
                    data: dependencies.appData,
                    mediaLoader: dependencies.mediaLoader,
                    router: router,
                    tabs: dependencies.tabs,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                ),
                showLocal: { destination = .workout($0) }
            )
        }
    }
}
