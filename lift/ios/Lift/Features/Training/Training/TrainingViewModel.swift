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
    private let seeds: any ActivitySeeding
    private let tabs: any TabSwitching
    private let list: AppResource<ActivityListPage>
    private let trends: AppResource<TrendsResponse>
    /// Pull to refresh starts the paging again even when the first page did not change.
    @ObservationIgnored private var restartsPaging = false
    /// Counts the times the paging started again. A "load more" that began before one drops its page: after a refresh
    /// the cursor can be the same, so the cursor alone cannot tell an old page from a new one.
    @ObservationIgnored private var listGeneration = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        data: any AppDataSource,
        router: any Navigating,
        tabs: any TabSwitching,
        seeds: any ActivitySeeding,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        segment: TrainingSegment
    ) {
        self.seeds = seeds
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
            if let summary = state.rows.first(where: { $0.id == id }) {
                seeds.remember(summary)
            }
            router.open(.activity(id))
        case .loadMoreTapped:
            return loadMore()
        case .refreshPulled:
            restartsPaging = true
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
            let shownFirst = state.list.content.value
            state.list = update
            // An offline update shows the kept first page again: the loaded pages stay.
            guard let page = update.content.value, update.freshness?.isOffline != true else { return }
            // A return to the tab that gets the same first page keeps the loaded pages; a new first page, or pull to
            // refresh, starts the paging again.
            let isSameFirst = page.activities == shownFirst?.activities && page.nextCursor == shownFirst?.nextCursor
            if isSameFirst && !state.more.isEmpty && !restartsPaging { return }
            restartsPaging = false
            listGeneration += 1
            state.more = []
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
        let generation = listGeneration
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
                // A refresh while this page loaded started the paging again: this page belongs to the old list.
                guard generation == listGeneration else { return }
                let shown = Set(state.rows.map(\.id))
                let added = page.activities.filter { !shown.contains($0.id) }
                state.more += added
                // A page with nothing new ends the list, so a server that repeats a page never loops.
                state.nextCursor = added.isEmpty ? nil : page.nextCursor
                state.footer = state.footer.pageLoaded(loadedCount: state.rows.count, hasMore: state.nextCursor != nil)
            } catch {
                guard generation == listGeneration else { return }
                state.footer = state.footer.loadFailed()
            }
        }
    }
}
