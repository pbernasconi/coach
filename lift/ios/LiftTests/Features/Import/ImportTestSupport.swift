import Foundation
import LiftCore
import LiftStore
import LiftTesting

@testable import Lift

/// A made-up note and a ViewModel wired to an in-memory store, for the import flow tests (TEST-8: no real notes).
@MainActor
struct ImportHarness {
    /// Two workouts: a matched lift with a skipped set, a name the library does not know, and a line before the
    /// first title. Six sets, five of them logged.
    static let note = """
        Gym notebook
        Workout A - Oct 6
        3x 60kg x 5reps x squat
        - [x] 5 x 60kg
        - [x] 5 x 62.5kg
        - [ ] 5 x 60kg
        Landmine rotation
        - [x] 12 @ 10kg
        Workout B - Oct 9
        Romanian deadlift
        - [x] 8 @ 70kg
        - [x] 8 @ 70kg
        """

    static let dayA = LocalDay(year: 2026, month: 10, day: 6)
    static let dayB = LocalDay(year: 2026, month: 10, day: 9)
    /// 2026-10-15T12:00:00Z, a made-up "now" after both workouts.
    static let now: @Sendable () -> Date = { Date(timeIntervalSince1970: 1_792_065_600) }

    let store: TestStore
    let pasteboard: FakePasteboard
    let flow = RecordingImportFlow()

    /// A store with the seed library installed.
    static func make(clipboard: String? = nil) async throws -> ImportHarness {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        return ImportHarness(store: store, pasteboard: FakePasteboard(text: clipboard))
    }

    func viewModel(text: String = "", readsOnOpen: Bool = false, sets: (any SetRepository)? = nil)
        -> ImportNotesViewModel
    {
        ImportNotesViewModel(
            request: ImportRequest(id: 1, text: text, readsOnOpen: readsOnOpen),
            sessions: store.sessions,
            sets: sets ?? store.sets,
            exercises: store.exercises,
            pasteboard: pasteboard,
            flow: flow,
            now: Self.now,
            calendar: SessionBuilder.calendar
        )
    }

    /// The live sessions on the note's days, as stored.
    func storedSessions() async -> [SessionDetail] {
        for await details in store.sessions.observeSessions(from: Self.dayA, through: Self.dayB) {
            return details
        }
        return []
    }

    /// The live library exercises, as stored.
    func storedExercises() async -> [Exercise] {
        for await exercises in store.exercises.observeExercises() {
            return exercises
        }
        return []
    }
}

extension ImportNotesState {
    /// The review, when the flow is on the review step.
    var review: ImportReview? {
        guard case .review(let review) = step else { return nil }
        return review
    }

    /// The outcome, when the flow has finished.
    var outcome: ImportOutcome? {
        guard case .outcome(let outcome) = step else { return nil }
        return outcome
    }
}
