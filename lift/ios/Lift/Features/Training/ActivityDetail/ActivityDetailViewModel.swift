import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import Observation

/// One activity's page (lift/APP-API.md, "Detail"). It shows what the server sends, section by section.
@Observable
final class ActivityDetailViewModel {
    private(set) var state: ActivityDetailState

    private let resource: AppResource<ActivityDetail>
    private let router: any Navigating
    private let tabs: any TabSwitching
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        activityID: String,
        data: any AppDataSource,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.tabs = tabs
        self.state = ActivityDetailState(activityID: activityID)
        self.resource = AppResource(
            path: ActivityDetail.path(activityID),
            source: data,
            now: now,
            days: DayCalendar(calendar: calendar)
        )
        self.router = router
    }

    /// Started by the Screen's `.task`; cancelled when the view goes away (SCR-4).
    func run() async {
        await load()
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: ActivityDetailAction) -> Task<Void, Never>? {
        switch action {
        case .retryTapped:
            state.detail.content = .loading
            return Task { await load() }
        case .refreshPulled:
            return Task { await load() }
        case .neighbourTapped(let id):
            router.back()
            router.open(.activity(id))
        case .activityTapped(let id):
            router.open(.activity(id))
        case .axisChanged(let axis):
            state.axis = axis
        case .paceModeChanged(let mode):
            state.paceMode = mode
        case .mapExpandTapped:
            state.destination = .map
        case .destinationDismissed:
            state.destination = nil
        case .connectTapped:
            tabs.show(.settings)
        }
        return nil
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.detail) { state.detail = $0 }
    }
}
