import Foundation
import Testing

@testable import LiftCore

@Suite struct CodableTests {
    @Test func sessionRoundTripsThroughJSON() throws {
        let set = LoggedSet(
            id: TestCalendar.id(3),
            kind: .working,
            target: SetTarget(reps: nil, repRange: 8...12, weight: .lb(50)),
            actual: SetActual(reps: 10, weight: .lb(50), completedAt: TestCalendar.date(2026, 3, 2)),
            note: "smooth"
        )
        let exercise = SessionExercise(
            id: TestCalendar.id(2),
            exerciseID: ExerciseLibrary.seedID(6),
            displayName: "DB bench",
            loadMode: .bodyweight(added: .kg(5)),
            equipment: .dumbbell,
            sets: [set],
            restSeconds: 90,
            supersetGroup: 1,
            nextTimeHint: .lb(55)
        )
        let session = Session(
            id: TestCalendar.id(1),
            date: LocalDay(year: 2026, month: 3, day: 2),
            title: "Upper A",
            exercises: [exercise],
            unitsAtLog: .lb,
            createdAt: TestCalendar.date(2026, 3, 2),
            updatedAt: TestCalendar.date(2026, 3, 2)
        )
        let data = try JSONEncoder().encode(session)
        #expect(try JSONDecoder().decode(Session.self, from: data) == session)
    }

    @Test func doneNeedsAnActualAndNoSkip() {
        let id = TestCalendar.id(1)
        #expect(LoggedSet(id: id, actual: SetActual(reps: 5)).isDone)
        #expect(!LoggedSet(id: id).isDone)
        #expect(!LoggedSet(id: id, actual: SetActual(reps: 5), isSkipped: true).isDone)
    }
}
