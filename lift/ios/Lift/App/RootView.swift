import KoboComponents
import KoboTokens
import SwiftUI

/// The app shell: the tab bar once the data is ready, or an error when the database could not be opened.
struct RootView: View {
    let launch: CompositionRoot.Launch
    let options: LaunchOptions

    var body: some View {
        switch launch {
        case .ready(let dependencies):
            AppShell(dependencies: dependencies, options: options)
        case .failed:
            ErrorState(title: "Lift could not open its data", message: "Close Lift and open it again.")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .screenCanvas()
        }
    }
}

/// The four tabs, each with its own navigation stack. Shown after `AppDependencies.prepare()` finishes.
private struct AppShell: View {
    private let dependencies: AppDependencies
    private let options: LaunchOptions
    @State private var tab: AppTab
    @State private var isReady = false
    /// The route `options.opening` pushes on its tab (`-open workout`, `-open exercise`), worked out after
    /// `prepare()`.
    @State private var openedRoute: AppRoute?

    init(dependencies: AppDependencies, options: LaunchOptions) {
        self.dependencies = dependencies
        self.options = options
        _tab = State(initialValue: options.initialTab)
    }

    var body: some View {
        Group {
            if isReady {
                TabShell(tabs: tabs, selection: $tab) { tab in
                    TabStack(tab: tab, dependencies: dependencies, initialPath: initialPath(for: tab))
                }
            } else {
                LoadingState()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .screenCanvas()
            }
        }
        .environment(\.calendar, dependencies.calendar)
        .task {
            await dependencies.prepare()
            if let opening = options.opening {
                let sessionID = opening == .workout ? await dependencies.upcomingSessionID() : nil
                openedRoute = options.initialRoute(upcomingSessionID: sessionID)
            }
            isReady = true
        }
    }

    private func initialPath(for tab: AppTab) -> [AppRoute] {
        guard tab == options.opening?.tab, let openedRoute else { return [] }
        return [openedRoute]
    }

    private var tabs: [KoboTab<AppTab>] {
        [
            KoboTab("Week", systemImage: AppTab.week.systemImage, value: .week),
            KoboTab("History", systemImage: AppTab.history.systemImage, value: .history),
            KoboTab("Exercises", systemImage: AppTab.exercises.systemImage, value: .exercises),
            KoboTab("Settings", systemImage: AppTab.settings.systemImage, value: .settings),
        ]
    }
}

/// One tab's navigation stack: its root screen plus any pushed routes.
private struct TabStack: View {
    let tab: AppTab
    let dependencies: AppDependencies
    @State private var router: TabRouter

    init(tab: AppTab, dependencies: AppDependencies, initialPath: [AppRoute]) {
        self.tab = tab
        self.dependencies = dependencies
        _router = State(initialValue: TabRouter(path: initialPath))
    }

    var body: some View {
        NavigationStack(path: $router.path) {
            TabRootScreen(tab: tab, dependencies: dependencies, router: router)
                .navigationDestination(for: AppRoute.self) { route in
                    RouteScreen(route: route, dependencies: dependencies, router: router)
                }
        }
    }
}

/// Builds the root screen of a tab and hands it the dependencies it needs (DI-1).
private struct TabRootScreen: View {
    let tab: AppTab
    let dependencies: AppDependencies
    let router: any Navigating

    var body: some View {
        switch tab {
        case .week:
            WeekScreen(
                viewModel: WeekViewModel(
                    sessions: dependencies.sessions,
                    router: router,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                )
            )
        case .history:
            HistoryScreen(
                viewModel: HistoryViewModel(
                    sessions: dependencies.sessions,
                    router: router,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                )
            )
        case .exercises:
            ExercisesScreen(viewModel: ExercisesViewModel(exercises: dependencies.exercises, router: router))
        case .settings:
            SettingsScreen(viewModel: SettingsViewModel(info: dependencies.info, router: router))
        }
    }
}
