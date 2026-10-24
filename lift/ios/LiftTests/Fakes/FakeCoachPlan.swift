import Foundation
import LiftCore
import LiftSync
import Synchronization

@testable import Lift

/// A `CoachPlanProviding` whose stream yields `snapshots`, then finishes, so `await vm.run()` returns. Records the weeks
/// it was asked to show and each refresh.
@MainActor
final class FakeCoachPlan: CoachPlanProviding {
    var snapshotsToYield: [CoachPlanSnapshot]
    private(set) var shownWeeks: [LocalDay] = []
    private(set) var refreshCount = 0
    /// Each move and delete, in order.
    private(set) var edits: [CoachPlanEdit] = []
    /// Thrown by every move and delete when set.
    var editError: SyncTransportError?

    init(_ snapshots: [CoachPlanSnapshot]) {
        snapshotsToYield = snapshots
    }

    func snapshots() -> AsyncStream<CoachPlanSnapshot> {
        let (stream, continuation) = AsyncStream.makeStream(of: CoachPlanSnapshot.self)
        for snapshot in snapshotsToYield { continuation.yield(snapshot) }
        continuation.finish()
        return stream
    }

    func show(weekStart: LocalDay) async {
        shownWeeks.append(weekStart)
    }

    func refresh() async {
        refreshCount += 1
    }

    func watchSync() async {}

    func move(_ id: String, to day: LocalDay) async throws {
        edits.append(.move(id: id, to: day))
        if let editError { throw editError }
    }

    func delete(_ id: String) async throws {
        edits.append(.remove(id: id))
        if let editError { throw editError }
    }
}

/// A `CoachPlanFetching` that answers from `responses` (by start week) and records each request; `error` wins.
nonisolated final class FakeCoachPlanClient: CoachPlanFetching {
    private let state: Mutex<(responses: [LocalDay: Data], error: SyncTransportError?, requests: [LocalDay])>

    init(responses: [LocalDay: Data] = [:], error: SyncTransportError? = nil) {
        state = Mutex((responses, error, []))
    }

    var requests: [LocalDay] { state.withLock { $0.requests } }

    func fail(with error: SyncTransportError?) {
        state.withLock { $0.error = error }
    }

    func weeks(from start: LocalDay, count _: Int, timeZone _: String) async throws -> CoachPlanResponse {
        let (data, error) = state.withLock { state in
            state.requests.append(start)
            return (state.responses[start], state.error)
        }
        if let error { throw error }
        guard let data else { throw SyncTransportError.rejected(status: 404) }
        return try CoachPlanResponse(data: data)
    }
}

/// A `CoachPlanStoring` in memory, standing in for Application Support.
nonisolated final class InMemoryCoachPlanCache: CoachPlanStoring {
    private let bodies: Mutex<[LocalDay: Data]>

    init(_ bodies: [LocalDay: Data] = [:]) {
        self.bodies = Mutex(bodies)
    }

    var stored: [LocalDay: Data] { bodies.withLock { $0 } }

    func load() -> [Data] { bodies.withLock { Array($0.values) } }

    func save(_ data: Data, start: LocalDay) throws {
        bodies.withLock { $0[start] = data }
    }

    func prune(keeping range: ClosedRange<LocalDay>) {
        bodies.withLock { bodies in bodies = bodies.filter { range.contains($0.key) } }
    }
}

/// Made-up Week API bodies (TEST-8), in the contract's shape (lift/WEEK-API.md).
nonisolated enum CoachPlanSamples {
    /// An item as JSON. `session` fills `liftSessionId`, as given (the server sends lower case).
    static func item(
        _ id: String,
        on day: LocalDay,
        sport: String = "ride",
        state: String = "planned",
        session: String? = nil,
        unplanned: Bool = false
    ) -> String {
        let link = session.map { "\"\($0)\"" } ?? "null"
        return """
            {"id":"\(id)","date":"\(CoachPlanDates.plain(day))","startTime":null,"endTime":null,"title":"\(id) title",
            "sport":"\(sport)","workoutType":null,"intensity":null,"durationMinutes":60,"tss":50,"subtitle":"60 min",
            "state":"\(state)","stateLabel":"\(state.capitalized)","compliance":null,"adapted":false,"unplanned":\(unplanned),"why":"Because",
            "notes":null,"keyTargets":[],"steps":[{"label":"Warm up","detail":"10:00"}],"liftSessionId":\(link),
            "done":{"source":"strava","name":null,"minutes":62,"tss":70,"text":"62 min / 60 min","activityId":"8001"}}
            """
    }

    /// A body with one week from `start`; `items` go on their own days.
    static func body(start: LocalDay, items: [(LocalDay, String)], generatedAt: String = "2026-03-02T13:05:00.000Z")
        -> Data
    {
        let days = (0..<7).map { index in
            let day = start.adding(days: index)
            let json = items.filter { $0.0 == day }.map(\.1).joined(separator: ",")
            return #"{"date":"\#(CoachPlanDates.plain(day))","items":[\#(json)]}"#
        }
        let week = """
            {"start":"\(CoachPlanDates.plain(start))","title":"Build week 3","hasPlan":true,
            "totals":{"plannedMinutes":540,"plannedTss":520,"doneMinutes":0,"doneTss":0,"plannedCount":9,"doneCount":0,
            "missedCount":0,"text":"0/9 done · 0:00 of 9:00"},"days":[\(days.joined(separator: ","))]}
            """
        let json = """
            {"generatedAt":"\(generatedAt)","timeZone":"UTC","today":"\(CoachPlanDates.plain(start))","weeks":[\(week)]}
            """
        return Data(json.utf8)
    }

    /// The body decoded.
    static func plan(start: LocalDay, items: [(LocalDay, String)]) throws -> CoachPlan {
        try CoachPlanResponse(data: body(start: start, items: items)).plan
    }
}
