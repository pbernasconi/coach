import Foundation
import LiftCore
import LiftSync

/// Fetches the Week API for the shown week and the next, keeps each successful body on disk, and shows the kept weeks
/// when a fetch fails. It never works out plan states: the server sends them (lift/WEEK-API.md).
final class LiveCoachPlan: CoachPlanProviding {
    /// Weeks per request: the shown week and the next.
    static let weeksPerFetch = 2

    private let client: any CoachPlanFetching
    /// The App API, for the plan writes (move, delete).
    private let writer: any AppDataSource
    private let cache: any CoachPlanStoring
    private let sync: any Syncing
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    private var snapshot = CoachPlanSnapshot(status: .ready, book: CoachPlanBook())
    private var hasLoadedCache = false
    private var isLoadingCache = false
    /// The shown week's first day; this week until the Week screen says otherwise.
    private var shownWeek: LocalDay?
    /// Start weeks with a request in flight, so a second trigger does not ask twice.
    private var inFlight: Set<LocalDay> = []
    /// Start weeks asked for again while their request was in flight (a sync run ended meanwhile): fetched once more
    /// when it ends, so the plan never stays on a response made before that sync's sets reached the server.
    private var askedAgain: Set<LocalDay> = []
    private var subscribers: [Int: AsyncStream<CoachPlanSnapshot>.Continuation] = [:]
    private var nextSubscriber = 0

    init(
        client: any CoachPlanFetching,
        writer: any AppDataSource,
        cache: any CoachPlanStoring,
        sync: any Syncing,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.client = client
        self.writer = writer
        self.cache = cache
        self.sync = sync
        self.now = now
        self.days = DayCalendar(calendar: calendar)
    }

    /// The first value comes once the kept plan is read from disk (off the main actor).
    func snapshots() -> AsyncStream<CoachPlanSnapshot> {
        let (stream, continuation) = AsyncStream.makeStream(
            of: CoachPlanSnapshot.self,
            bufferingPolicy: .bufferingNewest(1)
        )
        let id = nextSubscriber
        nextSubscriber += 1
        subscribers[id] = continuation
        if hasLoadedCache {
            continuation.yield(snapshot)
        } else {
            Task { await loadCacheOnce() }
        }
        continuation.onTermination = { [weak self] _ in
            Task { @MainActor in self?.subscribers.removeValue(forKey: id) }
        }
        return stream
    }

    /// Shows the kept weeks at once, then fetches them again unless they are fresh (fetched in the last
    /// `freshFor`), so a week kept from long ago (a past week) catches up with the server.
    func show(weekStart: LocalDay) async {
        await loadCacheOnce()
        shownWeek = weekStart
        guard snapshot.status != .off, !isFresh(Self.weeks(from: weekStart)) else { return }
        await fetch(from: weekStart)
    }

    /// How long a kept week counts as fresh.
    static let freshFor: TimeInterval = 5 * 60

    private func isFresh(_ starts: [LocalDay]) -> Bool {
        let book = snapshot.book
        guard book.holds(starts) else { return false }
        return starts.allSatisfy { start in
            book.updatedAt(of: start).map { now().timeIntervalSince($0) < Self.freshFor } ?? false
        }
    }

    func refresh() async {
        await loadCacheOnce()
        // Pull to refresh brings this iPhone up to date too: sets logged on the web or another device come in.
        if sync.isConfigured { await sync.syncNow() }
        await fetch(from: shownWeek ?? thisWeek)
    }

    /// After each sync, fetches the plan again. It never syncs itself: a sync here would end in a new status, and
    /// that status would start the next sync, without end.
    func watchSync() async {
        for await status in sync.statusUpdates() where status.phase != .syncing {
            await loadCacheOnce()
            await fetch(from: shownWeek ?? thisWeek)
        }
    }

    // MARK: - Writes

    func move(_ id: String, to day: LocalDay) async throws {
        let body = try JSONEncoder().encode(["date": CoachPlanDates.plain(day)])
        let writer = writer
        try await write(.move(id: id, to: day)) { _ = try await writer.put(AppPlannedWorkout.datePath(id), body: body) }
    }

    func delete(_ id: String) async throws {
        let writer = writer
        try await write(.remove(id: id)) { _ = try await writer.delete(AppPlannedWorkout.path(id)) }
    }

    /// Shows `edit` at once, sends it, then fetches the shown weeks: the server's answer replaces the guess, and a
    /// refused write comes back as it was.
    private func write(_ edit: CoachPlanEdit, _ send: () async throws -> Void) async throws {
        snapshot.book.apply(edit)
        publish()
        do {
            try await send()
        } catch {
            await fetch(from: shownWeek ?? thisWeek)
            throw error
        }
        await fetch(from: shownWeek ?? thisWeek)
    }

    // MARK: - Fetch

    private var thisWeek: LocalDay {
        days.weekStart(of: days.day(of: now()))
    }

    private static func weeks(from start: LocalDay) -> [LocalDay] {
        (0..<weeksPerFetch).map { start.adding(days: 7 * $0) }
    }

    private func fetch(from start: LocalDay) async {
        guard !inFlight.contains(start) else {
            askedAgain.insert(start)
            return
        }
        inFlight.insert(start)
        defer { inFlight.remove(start) }
        repeat {
            askedAgain.remove(start)
            await fetchOnce(from: start)
        } while askedAgain.contains(start) && !Task.isCancelled
    }

    private func fetchOnce(from start: LocalDay) async {
        do {
            let response = try await client.weeks(
                from: start,
                count: Self.weeksPerFetch,
                timeZone: days.calendar.timeZone.identifier
            )
            await keep(response, start: start)
            snapshot.book.add(response.plan)
            snapshot.status = .ready
        } catch SyncTransportError.missingToken, SyncTransportError.unauthorized {
            // No token, or one the coach refused: Week shows only Lift sessions, as without sync.
            snapshot.status = .off
        } catch is CancellationError {
            return
        } catch {
            AppLog.sync.error("Week plan fetch failed: \(String(describing: error), privacy: .public)")
            snapshot.status = .offline
        }
        publish()
    }

    /// Writes the body to disk and drops bodies for weeks the strip can no longer show, off the main actor.
    private func keep(_ response: CoachPlanResponse, start: LocalDay) async {
        let week = thisWeek
        let range =
            week.adding(
                days: 7 * WeekState.weeks.lowerBound
            )...week.adding(
                days: 7 * (WeekState.weeks.upperBound + 1)
            )
        await Self.write(response.data, start: start, keeping: range, in: cache)
    }

    @concurrent
    private nonisolated static func write(
        _ data: Data,
        start: LocalDay,
        keeping range: ClosedRange<LocalDay>,
        in cache: any CoachPlanStoring
    ) async {
        do {
            try cache.save(data, start: start)
        } catch {
            AppLog.sync.error("Week plan not kept: \(String(describing: error), privacy: .public)")
        }
        cache.prune(keeping: range)
    }

    /// Reads and decodes the kept bodies once, off the main actor, then tells every subscriber.
    private func loadCacheOnce() async {
        guard !hasLoadedCache, !isLoadingCache else { return }
        isLoadingCache = true
        let plans = await Self.read(cache)
        for plan in plans { snapshot.book.add(plan) }  // a fetch that finished first stays when it is newer
        hasLoadedCache = true
        isLoadingCache = false
        publish()
    }

    @concurrent
    private nonisolated static func read(_ cache: any CoachPlanStoring) async -> [CoachPlan] {
        cache.load().compactMap { try? CoachPlanResponse(data: $0).plan }
    }

    private func publish() {
        for continuation in subscribers.values { continuation.yield(snapshot) }
    }
}
