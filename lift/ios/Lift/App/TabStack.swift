import KoboComponents
import SwiftUI

/// One tab's navigation stack: its root screen plus any pushed routes, and the tab's toast slot, which outlives the
/// pages pushed on it.
struct TabStack: View {
    let tab: AppTab
    let dependencies: AppDependencies
    @State private var router: TabRouter
    @State private var toasts = ToastCenter()
    /// The last link request this stack showed (`TabSwitcher.routeRequests`).
    @State private var shownRouteSerial = 0

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
        let routeRequest = dependencies.tabs.routeRequests[tab]
        NavigationStack(path: $router.path) {
            TabRootScreen(
                tab: tab,
                dependencies: dependencies,
                router: router,
                options: options
            )
            // Every pushed page hides the tab bar (a detail page), for the whole app: driven from the root by the path.
            .detailPages(arePushed: !router.path.isEmpty)
            .navigationDestination(for: AppRoute.self) { route in
                RouteScreen(route: route, dependencies: dependencies, router: router, toasts: toasts)
            }
        }
        .toastHost(toasts)
        .onChange(of: rootRequests) { router.path.removeAll() }  // a re-tap of the tab goes back to its root
        .onChange(of: routeRequest) { show(routeRequest) }  // a link or a notice opened a screen on this tab
        .onAppear { show(routeRequest) }  // one that came before this tab was first shown
        // The workout bar goes back to the tab that has the workout open.
        .onChange(of: router.path, initial: true) { dependencies.tabs.stackChanged(tab, path: router.path) }
    }

    /// Shows a link's screen over the root, once per request.
    private func show(_ request: TabRouteRequest?) {
        guard let request, request.serial != shownRouteSerial else { return }
        shownRouteSerial = request.serial
        router.path = request.path
    }
}

/// Builds the root screen of a tab and hands it the dependencies it needs (DI-1).
struct TabRootScreen: View {
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
        case .coach:
            CoachScreen(
                viewModel: CoachViewModel(
                    coach: dependencies.coach,
                    plan: dependencies.coachPlan,
                    router: router,
                    tabs: dependencies.tabs,
                    mediaLoader: dependencies.mediaLoader,
                    speech: options.deniesVoice
                        ? DemoSpeechTranscriber(clock: dependencies.clock, isDenied: true) : dependencies.speech,
                    clock: dependencies.clock,
                    settings: dependencies.appSettings,
                    presence: dependencies.coachPresence
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
                    practice: dependencies.practice,
                    data: dependencies.appData,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    router: router
                )
            )
        }
    }
}
