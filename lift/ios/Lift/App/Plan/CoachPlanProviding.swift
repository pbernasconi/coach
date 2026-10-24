import Foundation
import LiftCore
import LiftSync

/// The coach's full weekly plan (lift/WEEK-API.md) as the Week screen reads it: the kept weeks and whether they are
/// current. `LiveCoachPlan` fetches and keeps it; `DemoCoachPlan` makes one up for demo data; `DisabledCoachPlan`
/// stands in when sync is off, and then the Week screen shows only Lift sessions.
@MainActor
protocol CoachPlanProviding: AnyObject {
    /// The plan now, then every change.
    func snapshots() -> AsyncStream<CoachPlanSnapshot>

    /// The Week screen shows the week of `weekStart`: fetches it and the next one when either is not kept yet.
    func show(weekStart: LocalDay) async

    /// Syncs this iPhone, then fetches the shown week and the next one now (pull to refresh).
    func refresh() async

    /// Runs for as long as the calling task: refreshes after every sync run (launch, foreground, Sync now, writes).
    func watchSync() async

    /// Moves the planned workout `id` (a Week API item) to `day` on the coach (lift/APP-API.md, "Move a workout"). The
    /// kept plan shows it there at once; the shown weeks are fetched again after the answer, or after a failure, which
    /// it throws (`SyncTransportError`; `.rejected(status: 409)` for a done workout).
    func move(_ id: String, to day: LocalDay) async throws

    /// Deletes the planned workout `id` on the coach ("Delete a workout"), the same way as `move`.
    func delete(_ id: String) async throws
}

/// What the Week screen knows of the plan.
nonisolated struct CoachPlanSnapshot: Equatable, Sendable {
    enum Status: Equatable, Sendable {
        /// Sync is off (no server, no token, `-fresh`): the Week screen shows only Lift sessions.
        case off
        /// The weeks are from the last fetch, or from disk until the first fetch ends.
        case ready
        /// The last fetch failed; the weeks are the kept ones.
        case offline
    }

    var status: Status
    var book: CoachPlanBook

    static let off = CoachPlanSnapshot(status: .off, book: CoachPlanBook())

    /// The kept weeks, or none when sync is off.
    var shownBook: CoachPlanBook? {
        status == .off ? nil : book
    }
}

/// The plan when sync is off: always `.off`, and nothing is ever fetched.
final class DisabledCoachPlan: CoachPlanProviding {
    func snapshots() -> AsyncStream<CoachPlanSnapshot> {
        let (stream, continuation) = AsyncStream.makeStream(of: CoachPlanSnapshot.self)
        continuation.yield(.off)
        continuation.finish()
        return stream
    }

    func show(weekStart _: LocalDay) async {}

    func refresh() async {}

    func watchSync() async {}

    func move(_: String, to _: LocalDay) async throws { throw SyncTransportError.missingToken }

    func delete(_: String) async throws { throw SyncTransportError.missingToken }
}
