import Foundation
import LiftStore
import Synchronization

/// A `WorkoutEventRepository` fake that keeps every moment recorded, for ViewModel tests (TEST-2).
public final class RecordingWorkoutEvents: WorkoutEventRepository {
    private let state: Mutex<[WorkoutEvent]> = Mutex([])

    public init() {}

    /// Every moment so far, in the order recorded.
    public var recorded: [WorkoutEvent] { state.withLock { $0 } }

    /// The kinds recorded so far, in order.
    public var kinds: [WorkoutEventKind] { recorded.map(\.kind) }

    public func record(_ event: WorkoutEvent) async throws {
        state.withLock { $0.append(event) }
    }

    public func events(sessionID _: UUID) async throws -> [WorkoutEventRecord] { [] }
}
