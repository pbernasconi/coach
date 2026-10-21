import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import Observation

/// The Training tab: the activity list, paged by the server's cursor, and Trends. It shows what the server sends.
@Observable
final class TrainingViewModel {
    /// Rows per page.
    static let pageSize = 30

    private(set) var state: TrainingState

    private let data: any AppDataSource
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let list: AppResource<ActivityListPage>
    private let trends: AppResource<TrendsResponse>

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        data: any AppDataSource,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        segment: TrainingSegment
    ) {
        let days = DayCalendar(calendar: calendar)
        self.data = data
        self.router = router
        self.tabs = tabs
        self.list = AppResource(path: ActivityListPage.path, source: data, now: now, days: days)
        self.trends = AppResource(path: TrendsResponse.path, source: data, now: now, days: days)
        self.state = TrainingState(segment: segment)
    }

    /// Loads the first page and Trends side by side; started by the Screen's `.task` (SCR-4).
    func run() async {
        await withDiscardingTaskGroup { group in
            group.addTask { await self.loadList() }
            group.addTask { await self.loadTrends() }
        }
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: TrainingAction) -> Task<Void, Never>? {
        switch action {
        case .segmentChanged(let segment):
            state.segment = segment
        case .activityTapped(let id):
            router.open(.activity(id))
        case .loadMoreTapped:
            return loadMore()
        case .refreshPulled:
            return Task { await run() }
        case .activitiesRetryTapped:
            state.list.content = .loading
            return Task { await loadList() }
        case .trendsRetryTapped:
            state.trends.content = .loading
            return Task { await loadTrends() }
        case .peaksWindowChanged(let window):
            state.peaksWindow = window
        case .mainLiftTapped(let key):
            router.open(.liftExercise(key))
        case .connectTapped:
            tabs.show(.settings)
        }
        return nil
    }

    private func loadList() async {
        await list.load(current: state.list) { update in
            state.list = update
            guard let page = update.content.value else { return }
            state.more = []  // a fresh first page starts the paging again
            state.nextCursor = page.nextCursor
            state.footer = LoadMoreFooterModel().pageLoaded(
                loadedCount: page.activities.count,
                hasMore: page.nextCursor != nil
            )
        }
    }

    private func loadTrends() async {
        await trends.load(current: state.trends) { state.trends = $0 }
    }

    private func loadMore() -> Task<Void, Never>? {
        guard let cursor = state.nextCursor, state.footer.phase == .idle || state.footer.phase == .failed else {
            return nil
        }
        state.footer = state.footer.loadStarted()
        return Task {
            do {
                let query = [
                    URLQueryItem(name: "before", value: cursor), URLQueryItem(name: "limit", value: "\(Self.pageSize)"),
                ]
                let kept = try await data.fetch(ActivityListPage.path, query: query)
                // Decoded off the main actor, like every App API body.
                guard let page = await AppResource<ActivityListPage>.decode(kept.data) else {
                    throw SyncTransportError.invalidResponse
                }
                let shown = Set(state.rows.map(\.id))
                let added = page.activities.filter { !shown.contains($0.id) }
                state.more += added
                // A page with nothing new ends the list, so a server that repeats a page never loops.
                state.nextCursor = added.isEmpty ? nil : page.nextCursor
                state.footer = state.footer.pageLoaded(loadedCount: state.rows.count, hasMore: state.nextCursor != nil)
            } catch {
                state.footer = state.footer.loadFailed()
            }
        }
    }
}
