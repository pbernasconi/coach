import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// Settings' kg/lb switch applied to the workout in progress: sets still to do convert to loads the gym can make,
/// logged sets keep the unit they were logged in (DATA-6), finished workouts are left alone.
@Suite struct SessionUnitSwitchTests {
    @Test func switchConvertsSetsStillToDoAndKeepsLoggedOnes() async throws {
        let store = try TestStore.make()
        let (session, slot) = try await store.sessionWithSquat(unit: .lb)
        let target = SetTarget(reps: 5, weight: .lb(240))
        let logged = try await store.sets.addSet(to: slot.id, kind: .working, target: target)
        let planned = try await store.sets.addSet(to: slot.id, kind: .working, target: target)
        let typed = try await store.sets.addSet(to: slot.id, kind: .working, target: target)
        _ = try await store.sets.log(setID: logged.id)
        _ = try await store.sets.saveValues(setID: typed.id, reps: 5, weight: .lb(225))
        try await store.drainOutbox()

        let changed = try await store.sessions.switchOpenSessions(to: .kg, from: Fixtures.monday, gym: .standard)

        #expect(changed == 1)
        let detail = try #require(await store.sessions.observeSession(id: session.id).first { _ in true } ?? nil)
        #expect(detail.session.unitsAtLog == .kg)
        let sets = Dictionary(uniqueKeysWithValues: detail.items.flatMap(\.sets).map { ($0.id, $0) })
        #expect(sets[logged.id]?.unit == .lb)
        #expect(sets[logged.id]?.actualWeight == .lb(240))
        #expect(sets[planned.id]?.unit == .kg)
        #expect(sets[planned.id]?.target.weight == .kg(110))  // 108.9 kg, to the 2.5 kg a pair of 1.25s makes
        #expect(sets[typed.id]?.target.weight == .kg(110))
        #expect(sets[typed.id]?.actualWeight == .kg(102.5))  // 102.1 kg
        // One entry per changed row: the session and the two sets still to do.
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity).sorted { $0.rawValue < $1.rawValue } == [.session, .set, .set])

        // A second switch to the same unit writes nothing.
        try await store.drainOutbox()
        #expect(try await store.sessions.switchOpenSessions(to: .kg, from: Fixtures.monday, gym: .standard) == 0)
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func switchLeavesFinishedAndEarlierWorkoutsAlone() async throws {
        let store = try TestStore.make()
        let (finished, slot) = try await store.sessionWithSquat(unit: .lb)
        let set = try await store.sets.addSet(to: slot.id, kind: .working, target: SetTarget(reps: 5, weight: .lb(240)))
        _ = try await store.sessions.finish(sessionID: finished.id)
        try await store.drainOutbox()

        #expect(try await store.sessions.switchOpenSessions(to: .kg, from: Fixtures.monday, gym: .standard) == 0)
        #expect(try await store.sessions.switchOpenSessions(to: .kg, from: Fixtures.monday.adding(days: 1), gym: .standard) == 0)
        #expect(try await store.pendingOutbox().isEmpty)
        let detail = try #require(await store.sessions.observeSession(id: finished.id).first { _ in true } ?? nil)
        #expect(detail.items.flatMap(\.sets).first { $0.id == set.id }?.unit == .lb)
    }
}
