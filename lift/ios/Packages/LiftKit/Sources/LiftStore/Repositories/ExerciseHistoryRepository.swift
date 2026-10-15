import Foundation
import LiftCore

/// One past session of an exercise: the session and the sets of that exercise logged in it.
public struct ExerciseHistoryEntry: Hashable, Sendable, Identifiable {
    public var session: SessionRecord
    /// The load mode stamped on the session exercise (DATA-6), for one-rep-max estimates.
    public var loadMode: LoadMode
    /// The logged (done) sets, in order. A session that lists the exercise twice contributes both.
    public var sets: [SetRecord]

    public var id: UUID { session.id }

    public init(session: SessionRecord, loadMode: LoadMode, sets: [SetRecord]) {
        self.session = session
        self.loadMode = loadMode
        self.sets = sets
    }
}

/// Reads the logged history of one library exercise (DATA-1).
public protocol ExerciseHistoryRepository: Sendable {
    /// The latest `limit` live sessions with at least one logged set of `exerciseID`, newest day first.
    func observeHistory(exerciseID: UUID, limit: Int) -> AsyncStream<[ExerciseHistoryEntry]>
}
