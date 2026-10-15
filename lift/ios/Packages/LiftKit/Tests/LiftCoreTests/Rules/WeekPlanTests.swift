import Foundation
import Testing

@testable import LiftCore

@Suite struct WeekPlanTests {
    @Test(arguments: [
        (0, 0, 2, nil as Int?, WeekProgress(done: 0, planned: 0, required: 2, goal: 2)),
        (1, 0, 2, nil, WeekProgress(done: 1, planned: 0, required: 1, goal: 2)),
        (1, 1, 2, nil, WeekProgress(done: 1, planned: 1, required: 0, goal: 2)),
        (3, 0, 2, nil, WeekProgress(done: 3, planned: 0, required: 0, goal: 2)),
        (1, 0, 2, 4, WeekProgress(done: 1, planned: 0, required: 1, goal: 4)),
        (0, 0, 3, 1, WeekProgress(done: 0, planned: 0, required: 3, goal: 3)),
        (-2, -1, 2, nil, WeekProgress(done: 0, planned: 0, required: 2, goal: 2)),
        (0, 0, -1, nil, WeekProgress(done: 0, planned: 0, required: 0, goal: 0)),
    ])
    func countsAgainstTheMinimum(done: Int, planned: Int, minimum: Int, goal: Int?, expected: WeekProgress) {
        #expect(WeekPlan.progress(done: done, planned: planned, minimum: minimum, goal: goal) == expected)
    }

    @Test func requiredThroughIsThePositionSegmentedProgressExpects() {
        #expect(WeekPlan.progress(done: 1, planned: 0).requiredThrough == 2)
        #expect(WeekPlan.progress(done: 3, planned: 1).requiredThrough == 4)
    }

    @Test func readsSessions() {
        let date = TestCalendar.date(2026, 3, 2)
        func session(_ sets: [LoggedSet], finished: Date? = nil, deleted: Date? = nil) -> Session {
            Session(
                id: TestCalendar.id(1),
                date: LocalDay(year: 2026, month: 3, day: 2),
                title: "A",
                exercises: [SessionExercise(id: TestCalendar.id(2), displayName: "Plank", loadMode: .total, sets: sets)],
                finishedAt: finished,
                unitsAtLog: .lb,
                createdAt: date,
                updatedAt: date,
                deletedAt: deleted
            )
        }
        let sessions = [
            session([TestCalendar.done(5, nil)]),
            session([], finished: date),
            session([LoggedSet(id: TestCalendar.id(3), target: SetTarget(reps: 5))]),
            session([TestCalendar.done(5, nil)], deleted: date),
        ]
        #expect(WeekPlan.progress(sessions: sessions) == WeekProgress(done: 2, planned: 1, required: 0, goal: 2))
        #expect(WeekPlan.progress(sessions: [], minimum: 3) == WeekProgress(done: 0, planned: 0, required: 3, goal: 3))
    }
}
