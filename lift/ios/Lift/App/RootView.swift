import KoboComponents
import KoboTokens
import SwiftUI

/// The app shell: the tab bar once the data is ready, or an error when the database could not be opened.
struct RootView: View {
    let launch: CompositionRoot.Launch
    let initialTab: AppTab

    var body: some View {
        switch launch {
        case .ready(let dependencies):
            AppShell(dependencies: dependencies, initialTab: initialTab)
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
    @State private var tab: AppTab
    @State private var isReady = false

    init(dependencies: AppDependencies, initialTab: AppTab) {
        self.dependencies = dependencies
        _tab = State(initialValue: initialTab)
    }

    var body: some View {
        Group {
            if isReady {
                TabShell(tabs: tabs, selection: $tab) { tab in
                    NavigationStack {
                        TabRootScreen(tab: tab, dependencies: dependencies)
                    }
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
            isReady = true
        }
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

/// Builds the root screen of a tab and hands it the dependencies it needs (DI-1).
private struct TabRootScreen: View {
    let tab: AppTab
    let dependencies: AppDependencies

    var body: some View {
        switch tab {
        case .week:
            WeekScreen(
                viewModel: WeekViewModel(
                    sessions: dependencies.sessions,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                )
            )
        case .history:
            HistoryScreen(
                viewModel: HistoryViewModel(
                    sessions: dependencies.sessions,
                    now: dependencies.now,
                    calendar: dependencies.calendar
                )
            )
        case .exercises:
            ExercisesScreen(viewModel: ExercisesViewModel(exercises: dependencies.exercises))
        case .settings:
            SettingsScreen(viewModel: SettingsViewModel(info: dependencies.info))
        }
    }
}
