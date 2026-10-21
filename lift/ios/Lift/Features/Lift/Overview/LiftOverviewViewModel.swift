import Foundation
import LiftSync
import Observation

@Observable
final class LiftOverviewViewModel {
    private(set) var state = LiftOverviewState()

    private let resource: AppResource<LiftOverview>
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let now: @Sendable () -> Date
    /// When the body last came fresh from the coach; a return within `LiftRefresh.interval` keeps it.
    @ObservationIgnored private var fetchedAt: Date?
    @ObservationIgnored private var isLoading = false
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        data: any AppDataSource,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.resource = AppResource(
            path: LiftOverview.path,
            source: data,
            now: now,
            days: DayCalendar(calendar: calendar)
        )
        self.router = router
        self.tabs = tabs
        self.now = now
    }

    /// Loads the page; started by the Screen's `.task` (SCR-4).
    func run() async {
        guard !LiftRefresh.isFresh(fetchedAt, now: now()) else { return }
        await load()
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.overview) { state.overview = $0 }
        if state.overview.content.value != nil, state.overview.freshness?.isOffline == false { fetchedAt = now() }
    }

    @discardableResult
    func send(_ action: LiftOverviewAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled, .retryTapped:
            if action == .retryTapped { state.overview.content = .loading }
            return Task { await load() }
        case .sessionTapped(let id):
            router.open(LiftLinks.session(id))
        case .exerciseTapped(let key):
            router.open(LiftLinks.exercise(key))
        case .tipTapped(let id):
            openTip(id)
        case .connectTapped:
            tabs.show(.settings)
        case .weeklyTapped:
            router.open(.liftWeekly)
        case .olderSessionsExpandedChanged(let isExpanded):
            state.isOlderSessionsExpanded = isExpanded
        case .exercisesExpandedChanged(let isExpanded):
            state.isExercisesExpanded = isExpanded
        }
        return nil
    }

    /// A tip's session or exercise opens it, a Week link shows the Week tab, and a section link scrolls there.
    private func openTip(_ id: String) {
        let tip = state.overview.content.value?.tips.value?.items.first { $0.id == id }
        guard let link = tip?.link else { return }
        if let route = LiftLinks.route(for: link) {
            router.open(route)
        } else if link == .week {
            tabs.show(.week)
        } else if case .section(let name) = link, let section = LiftOverviewSection(rawValue: name) {
            serial += 1
            state.scrollTarget = LiftOverviewScroll(section: section, serial: serial)
        }
    }
}
