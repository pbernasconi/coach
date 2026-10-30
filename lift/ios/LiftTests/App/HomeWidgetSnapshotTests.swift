import Foundation
import Testing

@testable import Lift

/// The Coach widget reads `/api/app/today` into its snapshot.
@Suite struct HomeWidgetSnapshotTests {
    private func body(_ json: String) -> Data { Data(json.utf8) }

    @Test func readsTheLoadAndTodaysWorkouts() throws {
        let snapshot = try HomeWidgetSnapshot.make(
            todayBody: body(
                """
                {"today": "2026-10-30",
                 "fitness": {"ok": true, "now": {"date": "2026-10-30", "ctl": 66.6, "atl": 42.2, "tsb": 19.4}},
                 "todayLine": {"ok": true, "emptyText": null, "items": [
                   {"id": "1", "title": "Heavy barbell lift", "sport": "strength", "state": "done",
                    "text": "07:00 · 1:15 · done", "liftSessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69"},
                   {"id": "2", "title": "Easy spin", "sport": "ride", "state": "planned", "text": "18:00 · 45m",
                    "liftSessionId": null}]}}
                """
            )
        )
        #expect(snapshot.day == "2026-10-30")
        #expect(snapshot.load == .init(fitness: 67, form: 19, fatigue: 42))
        #expect(snapshot.workouts.map(\.detail) == ["07:00 · 1:15", "18:00 · 45m"])
        #expect(snapshot.workouts.map(\.isDone) == [true, false])
        #expect(
            HomeWidgetSnapshot.link(for: snapshot.workouts[0])?.absoluteString
                == "lift://session/ca4f651b-98c7-4765-83a9-07ab74435d69"
        )
        #expect(HomeWidgetSnapshot.link(for: snapshot.workouts[1])?.absoluteString == "lift://today")
    }

    @Test func aFailedSectionLeavesOnlyItsPartEmpty() throws {
        let snapshot = try HomeWidgetSnapshot.make(
            todayBody: body(
                """
                {"today": "2026-10-30", "fitness": {"ok": false},
                 "todayLine": {"ok": true, "items": [], "emptyText": "Rest day"}}
                """
            )
        )
        #expect(snapshot.load == nil)
        #expect(snapshot.workouts.isEmpty)
        #expect(snapshot.emptyText == "Rest day")
    }

    @Test func negativeFormGetsATrueMinusSign() {
        #expect(HomeWidgetLoadRow.text(-4) == "\u{2212}4")
        #expect(HomeWidgetLoadRow.text(19) == "19")
    }

    @Test func aOneWorkoutFaceShowsTheNextToDoFirst() {
        let done = HomeWidgetSnapshot.Workout(
            id: "a", title: "Lift", sport: "strength", detail: "", isDone: true, liftSessionID: nil
        )
        let next = HomeWidgetSnapshot.Workout(
            id: "b", title: "Spin", sport: "ride", detail: "", isDone: false, liftSessionID: nil
        )
        #expect(HomeWidgetWorkoutList.ordered([done, next]).map(\.id) == ["b", "a"])
    }
}
