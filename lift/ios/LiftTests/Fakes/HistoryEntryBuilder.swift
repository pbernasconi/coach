import Foundation
import LiftCore
import LiftStore
import LiftTesting

/// Builds made-up `ExerciseHistoryEntry` values for the progress chart tests (TEST-8).
nonisolated enum HistoryEntryBuilder {
    /// A session `daysAgo` days before `Fixtures.monday` with `sets` logged sets of `reps` at `kilograms`.
    static func entry(_ number: UInt64, daysAgo: Int, reps: Int = 5, kilograms: Double, sets: Int = 3)
        -> ExerciseHistoryEntry
    {
        let session = SessionRecord(
            id: IDSequence.id(number, prefix: 0xE0),
            day: Fixtures.monday.adding(days: -daysAgo),
            title: "Lower A",
            unitsAtLog: .kg,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        let logged = (0..<sets).map { index in
            var set = SetRecord(
                id: IDSequence.id(UInt64(index + 1), prefix: UInt8(truncatingIfNeeded: number)),
                sessionExerciseID: IDSequence.id(number, prefix: 0xE1),
                position: index,
                kind: .working,
                target: SetTarget(reps: reps, weight: .kg(kilograms)),
                unit: .kg,
                loadMode: .total,
                createdAt: ManualNow.start
            )
            set.status = .done
            set.actualReps = reps
            set.actualWeight = .kg(kilograms)
            return set
        }
        return ExerciseHistoryEntry(session: session, loadMode: .total, sets: logged)
    }

    /// `count` weekly sessions, newest first as the repository returns them: the newest a week before
    /// `Fixtures.monday`, each one 2.5 kg lighter than the next, from 80 kg.
    static func weekly(_ count: Int) -> [ExerciseHistoryEntry] {
        (0..<count).map { index -> ExerciseHistoryEntry in
            let kilograms = 80 + 2.5 * Double(count - 1 - index)
            return entry(UInt64(index + 1), daysAgo: 7 * (index + 1), kilograms: kilograms)
        }
    }
}
