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
    @State private var isReady = false
    /// Syncs after launch, on returning to the foreground and after local writes.
    @State private var syncCoordinator: SyncCoordinator
    /// The route `options.opening` pushes on its tab (`-open workout`, `-open exercise`), worked out after
    /// `prepare()`.
    @State private var openedRoute: AppRoute?

    init(dependencies: AppDependencies, options: LaunchOptions) {
        self.dependencies = dependencies
        self.options = options
        _syncCoordinator = State(
            initialValue: SyncCoordinator(sync: dependencies.sync, outbox: dependencies.outbox)
        )
    }

    var body: some View {
        Group {
            if isReady {
                TabShell(tabs: tabs, selection: tabSelection) { tab in
                    TabStack(
                        tab: tab,
                        dependencies: dependencies,
                        initialPath: initialPath(for: tab),
                        options: options
                    )
                }
                .koboModalPage(item: importRequest, style: .sheet) { request in
                    ImportFlowPage(request: request, dependencies: dependencies)
                }
                .templateLinkFlow(dependencies)
                .task { await syncCoordinator.watchOutbox() }
                .task { await dependencies.coachPlan.watchSync() }  // the Week plan refreshes after each sync run
            } else {
                LoadingState()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .screenCanvas()
            }
        }
        .environment(\.calendar, dependencies.calendar)
        .task {
            dependencies.tabs.show(options.initialTab)  // before the tabs show; AppShell's init may run again
            await dependencies.prepare()
            openedRoute = await dependencies.openingRoute(for: options)
            if options.opensImportSample {
                dependencies.importFlow.present(text: ImportSample.note, readsOnOpen: true)
            } else if options.opensTemplateLinkSample {
                dependencies.templateLinks.present(payload: TemplateLinkSample.encoded)
            } else {
                dependencies.incomingNotes.checkInbox()
            }
            if let url = options.openURL, !options.isDemo {
                open(url)
            }
            isReady = true
            await syncCoordinator.launched()  // after the tabs show: logging never waits for the network
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            dependencies.incomingNotes.checkInbox()
            Task { await syncCoordinator.sceneBecameActive() }
        }
        .onOpenURL { url in open(url) }
    }

    /// Routes a `lift://` link. After a sync link, Settings shows, where the Sync row says how the first sync went.
    private func open(_ url: URL) {
        guard dependencies.incomingNotes.open(url), case .syncCode? = AppLink(url: url) else { return }
        dependencies.tabs.show(.settings)
    }

    /// The tab bar's selection: the shared `TabSwitcher`, so screens can switch tabs too.
    private var tabSelection: Binding<AppTab> {
        let tabs = dependencies.tabs
        return .action(tabs.selected) { tabs.barPicked($0) }
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
            KoboTab("Today", systemImage: AppTab.today.systemImage, value: .today),
            KoboTab("Week", systemImage: AppTab.week.systemImage, value: .week),
            KoboTab("Training", systemImage: AppTab.training.systemImage, value: .training),
            KoboTab("Lift", systemImage: AppTab.lift.systemImage, value: .lift),
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

    /// Where each root screen starts (segments, Today's scroll position), from the launch arguments.
    let options: LaunchOptions

    init(tab: AppTab, dependencies: AppDependencies, initialPath: [AppRoute], options: LaunchOptions) {
        self.tab = tab
        self.dependencies = dependencies
        self.options = options
        _router = State(initialValue: TabRouter(path: initialPath))
    }

    var body: some View {
        let rootRequests = dependencies.tabs.rootRequests[tab, default: 0]
        NavigationStack(path: $router.path) {
            TabRootScreen(
                tab: tab,
                dependencies: dependencies,
                router: router,
                options: options
            )
            .navigationDestination(for: AppRoute.self) { route in
                RouteScreen(route: route, dependencies: dependencies, router: router, toasts: toasts)
            }
        }
        .toastHost(toasts)
        .onChange(of: rootRequests) { router.path.removeAll() }  // a re-tap of the tab goes back to its root
    }
}

/// Builds the root screen of a tab and hands it the dependencies it needs (DI-1).
private struct TabRootScreen: View {
    let tab: AppTab
    let dependencies: AppDependencies
    let router: any Navigating
    let options: LaunchOptions

    var body: some View {
        switch tab {
        case .today:
            TodayScreen(
                viewModel: TodayViewModel(
                    data: dependencies.appData,
                    coachPlan: dependencies.coachPlan,
                    router: router,
                    tabs: dependencies.tabs,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    anchor: options.todayAnchor
                )
            )
        case .training:
            TrainingScreen(
                viewModel: TrainingViewModel(
                    data: dependencies.appData,
                    router: router,
                    tabs: dependencies.tabs,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    segment: options.trainingSegment
                )
            )
        case .lift:
            LiftTabScreen(
                dependencies: dependencies,
                router: router,
                historySegment: options.historySegment,
                initialSegment: options.liftSegment
            )
        case .week:
            WeekScreen(
                viewModel: WeekViewModel(
                    sessions: dependencies.sessions,
                    templates: dependencies.templates,
                    plans: dependencies.plans,
                    router: router,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    units: dependencies.units,
                    coachPlan: dependencies.coachPlan
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
