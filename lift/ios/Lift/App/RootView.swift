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
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: AppTab
    @State private var isReady = false
    /// Syncs after launch, on returning to the foreground and after local writes.
    @State private var syncCoordinator: SyncCoordinator
    /// The route `options.opening` pushes on its tab (`-open workout`, `-open exercise`), worked out after
    /// `prepare()`.
    @State private var openedRoute: AppRoute?

    init(dependencies: AppDependencies, options: LaunchOptions) {
        self.dependencies = dependencies
        self.options = options
        _tab = State(initialValue: options.initialTab)
        _syncCoordinator = State(
            initialValue: SyncCoordinator(sync: dependencies.sync, outbox: dependencies.outbox)
        )
    }

    var body: some View {
        Group {
            if isReady {
                TabShell(tabs: tabs, selection: $tab) { tab in
                    TabStack(
                        tab: tab,
                        dependencies: dependencies,
                        initialPath: initialPath(for: tab),
                        historySegment: options.historySegment
                    )
                }
                .koboModalPage(item: importRequest, style: .sheet) { request in
                    ImportFlowPage(request: request, dependencies: dependencies)
                }
                .templateLinkFlow(dependencies)
                .task { await syncCoordinator.watchOutbox() }
            } else {
                LoadingState()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .screenCanvas()
            }
        }
        .environment(\.calendar, dependencies.calendar)
        .task {
            await dependencies.prepare()
            openedRoute = await dependencies.openingRoute(for: options)
            if options.opensImportSample {
                dependencies.importFlow.present(text: ImportSample.note, readsOnOpen: true)
            } else if options.opensTemplateLinkSample {
                dependencies.templateLinks.present(payload: TemplateLinkSample.encoded)
            } else {
                dependencies.incomingNotes.checkInbox()
            }
            isReady = true
            await syncCoordinator.launched()  // after the tabs show: logging never waits for the network
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            dependencies.incomingNotes.checkInbox()
            Task { await syncCoordinator.sceneBecameActive() }
        }
        .onOpenURL { url in _ = dependencies.incomingNotes.open(url) }
    }

    /// Import from Notes, shown over the tabs while the presenter holds a request.
    private var importRequest: Binding<ImportRequest?> {
        let flow = dependencies.importFlow
        return .action(flow.request) { if $0 == nil { flow.dismissImport() } }
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

/// One tab's navigation stack: its root screen plus any pushed routes, and the tab's toast slot, which outlives the
/// pages pushed on it.
private struct TabStack: View {
    let tab: AppTab
    let dependencies: AppDependencies
    @State private var router: TabRouter
    @State private var toasts = ToastCenter()

    /// The History tab's first view: Sessions, or Progress for `-open progress`.
    let historySegment: HistorySegment

    init(tab: AppTab, dependencies: AppDependencies, initialPath: [AppRoute], historySegment: HistorySegment) {
        self.tab = tab
        self.dependencies = dependencies
        self.historySegment = historySegment
        _router = State(initialValue: TabRouter(path: initialPath))
    }

    var body: some View {
        NavigationStack(path: $router.path) {
            TabRootScreen(tab: tab, dependencies: dependencies, router: router, historySegment: historySegment)
                .navigationDestination(for: AppRoute.self) { route in
                    RouteScreen(route: route, dependencies: dependencies, router: router, toasts: toasts)
                }
        }
        .toastHost(toasts)
    }
}

/// Builds the root screen of a tab and hands it the dependencies it needs (DI-1).
private struct TabRootScreen: View {
    let tab: AppTab
    let dependencies: AppDependencies
    let router: any Navigating
    let historySegment: HistorySegment

    var body: some View {
        switch tab {
        case .week:
            WeekScreen(
                viewModel: WeekViewModel(
                    sessions: dependencies.sessions,
                    templates: dependencies.templates,
                    plans: dependencies.plans,
                    router: router,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    units: dependencies.units
                )
            )
        case .history:
            HistoryScreen(
                viewModel: HistoryViewModel(
                    sessions: dependencies.sessions,
                    exercises: dependencies.exercises,
                    router: router,
                    importFlow: dependencies.importFlow,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    segment: historySegment
                )
            )
        case .exercises:
            ExercisesScreen(
                viewModel: ExercisesViewModel(
                    exercises: dependencies.exercises,
                    catalog: dependencies.catalog,
                    router: router
                )
            )
        case .settings:
            SettingsScreen(
                viewModel: SettingsViewModel(
                    info: dependencies.info,
                    sync: dependencies.sync,
                    health: dependencies.health,
                    units: dependencies.units,
                    now: dependencies.now,
                    router: router
                )
            )
        }
    }
}
