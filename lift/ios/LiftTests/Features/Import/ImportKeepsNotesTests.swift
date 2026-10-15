import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// `importTapped` keeps everything a made-up note says (TEST-8): the session's and warm-up notes, the next-time weight,
/// set notes, and the workout's day as the time sets were logged (noon local), never the time of the import.
@MainActor
@Suite struct ImportKeepsNotesTests {
    private static let note = """
        Push day - Oct 6
        Warmup: 5 min rower
        Overhead press
        - [x] 5 x 40kg paused
        - [x] 5 x 40kg
        - [ ] 5 x 40kg didn't do it
        next time 42.5kg
        —
        Next time: start earlier
        """

    private func imported() async throws -> SessionDetail {
        let harness = try await ImportHarness.make()
        let vm = harness.viewModel(text: Self.note)
        await vm.send(.continueTapped)?.value
        await vm.send(.importTapped)?.value
        return try #require(await harness.storedSessions().first)
    }

    @Test func keepsTheSessionAndWarmUpNotes() async throws {
        let session = try await imported().session
        #expect(session.note == "Next time: start earlier")
        #expect(session.warmUpNote == "5 min rower")
    }

    @Test func keepsTheNextTimeWeightAndSetNotes() async throws {
        let press = try #require(try await imported().items.first)
        #expect(press.exercise.nextTimeHint == .kg(42.5))
        #expect(press.sets.map(\.note) == ["paused", nil, "didn't do it"])
        #expect(press.sets.map(\.status) == [.done, .done, .skipped])
    }

    @Test func stampsLoggedAndSkippedSetsAtNoonOnTheWorkoutDay() async throws {
        let press = try #require(try await imported().items.first)
        let noon = ImportHarness.dayA.noon(in: SessionBuilder.calendar)
        #expect(noon != nil)
        #expect(press.sets.map(\.completedAt) == [noon, noon, noon])
        #expect(press.sets.allSatisfy { $0.createdAt == ManualNow.start })  // the store's clock: the import's time
    }
}
