import Foundation
import LiftCore
import LiftStore

/// One set logged last time: its kind and the values logged on it.
nonisolated struct PreviousSet: Equatable, Sendable {
    var kind: SetKind
    var reps: Int?
    var weight: Weight?
}

/// The logged sets of one library exercise in its latest earlier session, for the PREVIOUS column and the editor.
nonisolated struct PreviousSets: Equatable, Sendable {
    var day: LocalDay
    /// The logged sets, in order.
    var sets: [PreviousSet]
    /// What was written about the exercise that time ("felt heavy"); nil when nothing was.
    var note: String?

    init(day: LocalDay, sets: [PreviousSet], note: String? = nil) {
        self.day = day
        self.sets = sets
        self.note = note
    }

    /// The newest entry from another session on or before `session`'s day. `entries` come newest day first, as the
    /// repository sends them. Nil when there is none.
    init?(entries: [ExerciseHistoryEntry], before session: SessionRecord) {
        let earlier = entries.first { $0.session.id != session.id && $0.session.day <= session.day }
        guard let earlier else { return nil }
        self.init(
            day: earlier.session.day,
            sets: earlier.sets.map { PreviousSet(kind: $0.kind, reps: $0.actualReps, weight: $0.actualWeight) },
            note: earlier.note
        )
    }

    /// The set at `number` (from 1) among the sets of `kind`: sets are matched by position within their kind.
    func set(kind: SetKind, number: Int) -> PreviousSet? {
        let same = sets.filter { $0.kind == kind }
        return same.indices.contains(number - 1) ? same[number - 1] : nil
    }
}

/// Reads the previous sets once: the first emission of each library exercise's history stream, then drops the stream.
nonisolated struct PreviousSetsLoader: Sendable {
    /// Enough sessions to step past the current one and any later ones.
    static let historyLimit = 8
    let history: any ExerciseHistoryRepository

    /// The previous sets of every library exercise in `detail`, by library exercise id.
    func load(for detail: SessionDetail) async -> [UUID: PreviousSets] {
        var result: [UUID: PreviousSets] = [:]
        for exerciseID in Set(detail.items.compactMap(\.exercise.exerciseID)) {
            let entries = await firstEmission(exerciseID)
            result[exerciseID] = PreviousSets(entries: entries, before: detail.session)
        }
        return result
    }

    private func firstEmission(_ exerciseID: UUID) async -> [ExerciseHistoryEntry] {
        for await entries in history.observeHistory(exerciseID: exerciseID, limit: Self.historyLimit) {
            return entries
        }
        return []
    }
}
