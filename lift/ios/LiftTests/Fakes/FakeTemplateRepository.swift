import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Synchronization

/// A `TemplateRepository` whose streams yield the given values, then finish, so `await vm.run()` returns. Every write
/// is recorded, then throws `error` when one is given (TEST-2).
nonisolated final class FakeTemplateRepository: TemplateRepository {
    enum Call: Equatable, Sendable {
        case create(String)
        case rename(UUID, String)
        case remove(UUID)
        case restore(UUID)
        case addExercise(UUID, to: UUID)
        case update(TemplateExercise)
        case removeExercise(UUID)
        case restoreExercise(UUID)
        case reorder(UUID, [UUID])
        case saveAsTemplate(UUID, String)
    }

    /// The id `createTemplate` and `saveAsTemplate` hand out.
    static let newID = IDSequence.id(1, prefix: 0xC1)

    private let emissions: [[DayTemplate]]
    private let error: AppError?
    private let recorded = Mutex<[Call]>([])

    init(emissions: [[DayTemplate]] = [[]], error: AppError? = nil) {
        self.emissions = emissions
        self.error = error
    }

    /// Every write, in order, including ones that threw.
    var calls: [Call] { recorded.withLock { $0 } }

    func observeTemplates() -> AsyncStream<[DayTemplate]> {
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions { continuation.yield(value) }
            continuation.finish()
        }
    }

    func observeTemplate(id: UUID) -> AsyncStream<DayTemplate?> {
        let emissions = emissions
        return AsyncStream { continuation in
            for value in emissions { continuation.yield(value.first { $0.id == id }) }
            continuation.finish()
        }
    }

    func createTemplate(name: String) async throws -> DayTemplate {
        try record(.create(name))
        return Self.template(name: name)
    }

    func renameTemplate(id: UUID, to name: String) async throws { try record(.rename(id, name)) }
    func removeTemplate(id: UUID) async throws { try record(.remove(id)) }
    func restoreTemplate(id: UUID) async throws { try record(.restore(id)) }

    func addExercise(_ exercise: Exercise, to templateID: UUID) async throws -> TemplateExercise {
        try record(.addExercise(exercise.id, to: templateID))
        return TemplateExercise(id: Self.newID, exerciseID: exercise.id, displayName: exercise.name)
    }

    func updateExercise(_ slot: TemplateExercise) async throws -> TemplateExercise {
        try record(.update(slot))
        return slot
    }

    func removeExercise(id: UUID) async throws { try record(.removeExercise(id)) }
    func restoreExercise(id: UUID) async throws { try record(.restoreExercise(id)) }
    func reorderExercises(in templateID: UUID, ids: [UUID]) async throws { try record(.reorder(templateID, ids)) }

    func saveAsTemplate(sessionID: UUID, name: String) async throws -> DayTemplate {
        try record(.saveAsTemplate(sessionID, name))
        return Self.template(name: name)
    }

    private func record(_ call: Call) throws {
        recorded.withLock { $0.append(call) }
        if let error { throw error }
    }

    private static func template(name: String) -> DayTemplate {
        DayTemplate(
            id: newID,
            name: name,
            exercises: [],
            position: 0,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }
}
