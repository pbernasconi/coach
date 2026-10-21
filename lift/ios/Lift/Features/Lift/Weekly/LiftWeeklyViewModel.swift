import Foundation
import Observation

@Observable
final class LiftWeeklyViewModel {
    /// The App API path of the screen.
    static let path = "api/app/lift/weekly"

    private(set) var state = LiftWeeklyState()

    private let resource: AppResource<LiftWeekly>
    private let tabs: any TabSwitching
    private let now: @Sendable () -> Date
    /// When the body last came fresh from the coach; a return within `LiftRefresh.interval` keeps it.
    @ObservationIgnored private var fetchedAt: Date?
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(data: any AppDataSource, tabs: any TabSwitching, now: @escaping @Sendable () -> Date, calendar: Calendar) {
        resource = AppResource(path: Self.path, source: data, now: now, days: DayCalendar(calendar: calendar))
        self.tabs = tabs
        self.now = now
    }

    /// Loads the page; started by the Screen's `.task` (SCR-4).
    func run() async {
        guard !LiftRefresh.isFresh(fetchedAt, now: now()) else { return }
        await load()
    }

    @discardableResult
    func send(_ action: LiftWeeklyAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled:
            return Task { await load() }
        case .retryTapped:
            state.weekly.content = .loading
            return Task { await load() }
        case .connectTapped:
            tabs.show(.settings)
            return nil
        }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.weekly) { state.weekly = $0 }
        if state.weekly.content.value != nil, state.weekly.freshness?.isOffline == false { fetchedAt = now() }
    }
}
