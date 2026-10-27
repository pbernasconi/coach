import KoboComponents
import KoboTokens
import SwiftUI

/// The app shell: the tab bar once the data is ready, or an error when the database could not be opened. Turning
/// practice mode on or off opens other data, and the shell starts over on it.
struct RootView: View {
    let launcher: AppLauncher
    let options: LaunchOptions
    /// The APNs token and tapped notices from the app delegate.
    let push: PushInbox

    var body: some View {
        switch launcher.launch {
        case .ready(let dependencies):
            AppShell(dependencies: dependencies, options: options, push: push)
                .id(launcher.generation)
        case .failed:
            ErrorState(title: "Coach could not open its data", message: "Close Coach and open it again.")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .screenCanvas()
        }
    }
}

/// The four tabs, each with its own navigation stack. Shown after `AppDependencies.prepare()` finishes.
private struct AppShell: View {
    private let dependencies: AppDependencies
    private let options: LaunchOptions
    private let push: PushInbox
    @Environment(\.scenePhase) private var scenePhase
    @State private var isReady = false
    /// Syncs after launch, on returning to the foreground and after local writes.
    @State private var syncCoordinator: SyncCoordinator
    /// The route `options.opening` pushes on its tab (`-open workout`, `-open exercise`), worked out after
    /// `prepare()`.
    @State private var openedRoute: AppRoute?

    init(dependencies: AppDependencies, options: LaunchOptions, push: PushInbox) {
        self.dependencies = dependencies
        self.options = options
        self.push = push
        _syncCoordinator = State(
            initialValue: SyncCoordinator(sync: dependencies.sync, outbox: dependencies.outbox)
        )
    }

    var body: some View {
        Group {
            if isReady {
                TabShell(tabs: tabs, selection: tabSelection, showsAccessory: underwayBar != nil) { tab in
                    TabStack(
                        tab: tab,
                        dependencies: dependencies,
                        initialPath: initialPath(for: tab),
                        options: options
                    )
                } accessory: {
                    // The workout under way, to go back to it after leaving the Workout screen. The tab bar, and this
                    // with it, hides on pushed pages, the Workout screen among them.
                    if let bar = underwayBar {
                        ActiveWorkoutAccessory(bar: bar) { dependencies.tabs.openWorkout(bar.sessionID) }
                    }
                }
                .koboModalPage(item: importRequest, style: .sheet) { request in
                    ImportFlowPage(request: request, dependencies: dependencies)
                }
                .templateLinkFlow(dependencies)
                .practiceBanner(isOn: dependencies.info.dataSource == .practice) {
                    dependencies.practice.setPracticeMode(false)
                }
                .task { await syncCoordinator.watchOutbox() }
                .task { await dependencies.coachPlan.watchSync() }  // the Week plan refreshes after each sync run
                .task { await dependencies.push?.registrar.run() }
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
            if let url = options.openURL, !options.isDemo || AppLink(url: url)?.destination != nil {
                open(url)
            }
            attachPush()
            isReady = true
            await syncCoordinator.launched()  // after the tabs show: logging never waits for the network
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            dependencies.incomingNotes.checkInbox()
            dependencies.push?.registrar.refresh()  // the permission may have changed in iOS Settings
            Task { await syncCoordinator.sceneBecameActive() }
        }
        .onOpenURL { url in open(url) }
    }

    /// Routes a `lift://` link. After a sync link, Settings shows, where the Sync row says how the first sync went.
    private func open(_ url: URL) {
        guard dependencies.incomingNotes.open(url), case .syncCode? = AppLink(url: url) else { return }
        dependencies.tabs.show(.settings)
    }

    /// Takes the APNs token and tapped notices from the app delegate, a tap that launched Lift included. A tap opens its
    /// link like any `lift://` link and tells the coach it was opened.
    private func attachPush() {
        push.coachPresence = dependencies.coachPresence
        push.attach(
            onToken: { token in dependencies.push?.registrar.tokenReceived(token) },
            onTap: { tap in
                dependencies.push?.tapped(tap)
                if let link = tap.link { open(link) }
            }
        )
        dependencies.push?.registrar.refresh()
    }

    /// The workout under way for the bar above the tab bar; nil while none is.
    private var underwayBar: ActiveWorkoutBar? { dependencies.workoutActivity.underway.bar }

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
            KoboTab("Week", systemImage: AppTab.week.systemImage, value: .week),
            KoboTab("Today", systemImage: AppTab.today.systemImage, value: .today),
            KoboTab("Coach", systemImage: AppTab.coach.systemImage, value: .coach),
            KoboTab("Lift", systemImage: AppTab.lift.systemImage, value: .lift),
            KoboTab("Settings", systemImage: AppTab.settings.systemImage, value: .settings),
        ]
    }
}
