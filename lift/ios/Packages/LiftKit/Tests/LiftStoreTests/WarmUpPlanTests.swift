import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// The warm-up planned into a session that has none (a session made elsewhere, opened in the workout).
@Suite struct WarmUpPlanTests {
    private func detail(_ id: UUID, _ store: TestStore) async throws -> SessionDetail {
        var stream = store.sessions.observeSession(id: id).makeAsyncIterator()
        return try #require(await stream.next() ?? nil)
    }

    @Test func plansTheRampAndTheChecklistOnce() async throws {
        let store = try TestStore.make()
        let (session, slot) = try await store.sessionWithSquat()
        let sessionID = session.id
        _ = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        try await store.sessions.planWarmUp(sessionID: sessionID, gym: .standard)
        let planned = try await detail(sessionID, store)
        #expect(planned.items[0].sets.map(\.kind) == [.warmUp, .warmUp, .warmUp, .warmUp, .working])
        #expect(planned.items[0].sets.map(\.position) == [0, 1, 2, 3, 4])
        #expect(WarmUpChecklist(note: planned.session.warmUpNote)?.items.count == WarmUpRecipe.heavyChecklist.count)

        // Once planned, never again, even after the warm-up sets were removed.
        for warmUp in planned.items[0].sets where warmUp.kind == .warmUp {
            try await store.sets.remove(setID: warmUp.id)
        }
        try await store.sessions.planWarmUp(sessionID: sessionID, gym: .standard)
        #expect(try await detail(sessionID, store).items[0].sets.count == 1)
    }

    @Test func aStartedSessionWithALoggedSetGetsNoWarmUp() async throws {
        let store = try TestStore.make()
        let (session, slot) = try await store.sessionWithSquat()
        let sessionID = session.id
        let set = try await store.sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        _ = try await store.sets.log(setID: set.id)
        try await store.sessions.planWarmUp(sessionID: sessionID, gym: .standard)
        let after = try await detail(sessionID, store)
        #expect(after.items[0].sets.count == 1)
        #expect(after.session.warmUpNote == nil)
    }

    @Test func savingTheChecklistKeepsIt() async throws {
        let store = try TestStore.make()
        let (session, _) = try await store.sessionWithSquat()
        let note = WarmUpChecklist(items: WarmUpRecipe.lightChecklist).toggling(1).note
        let saved = try await store.sessions.saveWarmUpNote(sessionID: session.id, note: note)
        #expect(saved.warmUpNote == note)
    }
}
