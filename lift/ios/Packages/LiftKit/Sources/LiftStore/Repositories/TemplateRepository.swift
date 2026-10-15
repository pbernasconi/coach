import Foundation
import LiftCore

/// Day templates and their exercise slots. Reads are streams (DATA-1); each write is one transaction that appends an
/// outbox entry for every row it changes (DATA-3). Removing is a soft delete, so it can be undone without asking.
public protocol TemplateRepository: Sendable {
    /// Live templates with their live slots in order, by list position then name. A slot shows the library
    /// exercise's current name.
    func observeTemplates() -> AsyncStream<[DayTemplate]>

    /// One live template, or nil once it is removed or if it never existed.
    func observeTemplate(id: UUID) -> AsyncStream<DayTemplate?>

    /// Adds an empty template at the end of the list.
    func createTemplate(name: String) async throws -> DayTemplate

    func renameTemplate(id: UUID, to name: String) async throws

    /// Soft-deletes a template. Sessions made from it keep their exercises.
    func removeTemplate(id: UUID) async throws

    /// Undoes `removeTemplate`.
    func restoreTemplate(id: UUID) async throws

    /// Appends a slot for a library exercise: as many sets and the rep target it had last time it was logged, or
    /// 3 × 8–12 with 2 minutes' rest when it never was.
    func addExercise(_ exercise: Exercise, to templateID: UUID) async throws -> TemplateExercise

    /// Saves a slot's set count, rep target, load, rest and kind.
    func updateExercise(_ slot: TemplateExercise) async throws -> TemplateExercise

    /// Soft-deletes a slot.
    func removeExercise(id: UUID) async throws

    /// Undoes `removeExercise`.
    func restoreExercise(id: UUID) async throws

    /// Puts the template's live slots in the order of `ids`, which must hold each of them once.
    func reorderExercises(in templateID: UUID, ids: [UUID]) async throws

    /// A new template named `name` from a session's library exercises (free-text exercises are left out): each slot
    /// gets the exercise's working set count, rep target, load and rest. The session is linked to the new template.
    func saveAsTemplate(sessionID: UUID, name: String) async throws -> DayTemplate
}
