import Foundation
import LiftCore
import LiftStore
import LiftTesting

/// Builds made-up `SessionDetail` values for ViewModel tests (TEST-8), and the fixed calendar they use.
nonisolated enum SessionBuilder {
    /// Gregorian, UTC, weeks start on Monday, POSIX locale: the same answers on every machine.
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return calendar.startingWeeksOnMonday()
    }()

    /// `ManualNow.start`: Monday 2026-03-02, 09:00 UTC (`Fixtures.monday`).
    static let now: @Sendable () -> Date = { ManualNow.start }

    /// A session on `day` with one exercise holding `done` logged sets and `planned` planned sets.
    static func session(id: UInt64, on day: LocalDay, title: String = "Lower A", done: Int, planned: Int)
        -> SessionDetail
    {
        let sessionID = IDSequence.id(id, prefix: 0xA0)
        let exerciseID = IDSequence.id(id, prefix: 0xB0)
        let record = SessionRecord(
            id: sessionID,
            day: day,
            title: title,
            unitsAtLog: .kg,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        let exercise = SessionExerciseRecord(
            id: exerciseID,
            sessionID: sessionID,
            slot: ExerciseSlot(exercise: Fixtures.squat),
            position: 0,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        let sets = (0..<(done + planned)).map { index in
            var set = SetRecord(
                id: IDSequence.id(UInt64(index + 1), prefix: UInt8(truncatingIfNeeded: id)),
                sessionExerciseID: exerciseID,
                position: index,
                kind: .working,
                target: Fixtures.fiveAt100,
                unit: .kg,
                loadMode: .total,
                createdAt: ManualNow.start
            )
            set.status = index < done ? .done : .planned
            return set
        }
        return SessionDetail(session: record, items: [SessionDetail.Item(exercise: exercise, sets: sets)])
    }
}
