import Foundation
import LiftCore
import LiftSync

/// Fetches the Week API for the shown week and the next, keeps each successful body on disk, and shows the kept weeks
/// when a fetch fails. It never works out plan states: the server sends them (lift/WEEK-API.md).
final class LiveCoachPlan: CoachPlanProviding {
    /// Weeks per request: the shown week and the next.
    static let weeksPerFetch = 2

    private let client: any CoachPlanFetching
    private let cache: any CoachPlanStoring
    private let sync: any Syncing
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    private var snapshot = CoachPlanSnapshot(status: .ready, book: CoachPlanBook())
    private var hasLoadedCache = false
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
        cache: any CoachPlanStoring,
        sync: any Syncing,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.client = client
        self.cache = cache
        self.sync = sync
        self.now = now
        self.days = DayCalendar(calendar: calendar)
    }

    func snapshots() -> AsyncStream<CoachPlanSnapshot> {
        loadCacheOnce()
        let (stream, continuation) = AsyncStream.makeStream(
            of: CoachPlanSnapshot.self,
            bufferingPolicy: .bufferingNewest(1)
        )
        let id = nextSubscriber
        nextSubscriber += 1
        subscribers[id] = continuation
        continuation.yield(snapshot)
        continuation.onTermination = { [weak self] _ in
            Task { @MainActor in self?.subscribers.removeValue(forKey: id) }
        }
        return stream
    }

    func show(weekStart: LocalDay) async {
        loadCacheOnce()
        shownWeek = weekStart
        guard snapshot.status != .off, !snapshot.book.holds(Self.weeks(from: weekStart)) else { return }
        await fetch(from: weekStart)
    }

    func refresh() async {
        loadCacheOnce()
        await fetch(from: shownWeek ?? thisWeek)
    }

    func watchSync() async {
        for await status in sync.statusUpdates() where status.phase != .syncing {
            await refresh()
        }
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
            keep(response, start: start)
            snapshot.book.add(response.plan)
            snapshot.status = .ready
        } catch SyncTransportError.missingToken {
            snapshot.status = .off
        } catch is CancellationError {
            return
        } catch {
            AppLog.sync.error("Week plan fetch failed: \(String(describing: error), privacy: .public)")
            snapshot.status = .offline
        }
        publish()
    }

    /// Writes the body to disk and drops bodies for weeks the strip can no longer show.
    private func keep(_ response: CoachPlanResponse, start: LocalDay) {
        do {
            try cache.save(response.data, start: start)
        } catch {
            AppLog.sync.error("Week plan not kept: \(String(describing: error), privacy: .public)")
        }
        let week = thisWeek
        cache.prune(
            keeping: week.adding(
                days: 7 * WeekState.weeks.lowerBound
            )...week.adding(days: 7 * (WeekState.weeks.upperBound + 1))
        )
    }

    private func loadCacheOnce() {
        guard !hasLoadedCache else { return }
        hasLoadedCache = true
        let plans = cache.load().compactMap { try? CoachPlanResponse(data: $0).plan }
        snapshot.book = CoachPlanBook(plans)
    }

    private func publish() {
        for continuation in subscribers.values { continuation.yield(snapshot) }
    }
}
