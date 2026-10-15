import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// Notes kept from an import show on the Workout screen and in History. Made-up sessions only (TEST-8).
@MainActor
@Suite struct WorkoutNotesTests {
    private func detailWithNotes() -> SessionDetail {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 1)
        detail.session.note = "Short on time\nNo lunges"
        detail.session.warmUpNote = "5 min rower"
        detail.items[0].exercise.note = "Elbows in\nnext time 102.5kg"
        detail.items[0].exercise.nextTimeHint = .kg(102.5)
        detail.items[0].sets[0].note = "paused"
        return detail
    }

    @Test func theOverviewCarriesTheSessionNotes() {
        let overview = WorkoutOverview(
            detail: detailWithNotes(),
            days: DayCalendar(calendar: SessionBuilder.calendar),
            previous: [:],
            gym: .standard
        )
        #expect(overview.note == "Short on time\nNo lunges")
        #expect(overview.warmUpNote == "5 min rower")
        #expect(overview.exercises.first?.sets.map(\.note) == ["paused", nil])
    }

    @Test func anExerciseNoteLeavesOutTheNextTimeLineTheHintShows() {
        let overview = WorkoutOverview(
            detail: detailWithNotes(),
            days: DayCalendar(calendar: SessionBuilder.calendar),
            previous: [:],
            gym: .standard
        )
        #expect(overview.exercises.first?.note == "Elbows in")
        #expect(overview.exercises.first?.progression == "Next time: 102.5 kg")
    }

    @Test(
        arguments: [
            ("Elbows in\nnext time 60kg", true, "Elbows in"),
            ("Elbows in\nnext time 60kg", false, "Elbows in\nnext time 60kg"),
            ("Next time 60kg", true, nil),
            ("  \n", false, nil),
        ] as [(String, Bool, String?)]
    )
    func exerciseNoteText(note: String, hasHint: Bool, shown: String?) {
        #expect(WorkoutText.exerciseNote(note, hasHint: hasHint) == shown)
    }

    @Test func historyShowsTheFirstLineOfTheNote() {
        #expect(SessionSummary(detail: detailWithNotes()).note == "Short on time")
        #expect(
            SessionSummary(detail: SessionBuilder.session(id: 2, on: Fixtures.monday, done: 1, planned: 0)).note == nil
        )
    }

    @Test(
        arguments: [
            (nil, nil),
            ("\n  Felt strong  \nsecond line", "Felt strong"),
            (String(repeating: "a", count: 100), String(repeating: "a", count: 79) + "…"),
        ] as [(String?, String?)]
    )
    func notePreview(note: String?, preview: String?) {
        #expect(SessionText.notePreview(note) == preview)
    }
}
