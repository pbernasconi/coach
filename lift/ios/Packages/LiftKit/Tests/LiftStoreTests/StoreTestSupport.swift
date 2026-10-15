import Foundation
import LiftCore
import LiftStore
import LiftTesting

extension TestStore {
    /// Acknowledges every pending outbox entry, so a test can count what one write appends.
    func drainOutbox() async throws {
        try await outbox.acknowledge(pendingOutbox().map(\.id))
    }

    func pendingOutbox() async throws -> [OutboxEntry] {
        try await outbox.pending(limit: 10_000)
    }

    /// A kg session on `Fixtures.monday` with one squat slot, outbox drained.
    func sessionWithSquat(unit: WeightUnit = .kg) async throws -> (SessionRecord, SessionExerciseRecord) {
        let session = try await sessions.createSession(
            on: Fixtures.monday,
            title: "Lower A",
            unit: unit,
            templateID: nil
        )
        let slot = try await sessions.addExercise(ExerciseSlot(exercise: Fixtures.squat), to: session.id)
        try await drainOutbox()
        return (session, slot)
    }

    /// A planned 5 × 100 kg squat set, outbox drained.
    func plannedSet(unit: WeightUnit = .kg) async throws -> SetRecord {
        let (_, slot) = try await sessionWithSquat(unit: unit)
        let set = try await sets.addSet(to: slot.id, kind: .working, target: Fixtures.fiveAt100)
        try await drainOutbox()
        return set
    }
}
