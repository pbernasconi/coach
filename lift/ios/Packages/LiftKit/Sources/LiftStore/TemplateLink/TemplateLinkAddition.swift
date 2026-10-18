import Foundation
import LiftCore

/// What adding a template link wrote, so Undo can take it all back: the templates it made, the ones it replaced
/// (soft-deleted) and the library exercises it created.
public struct TemplateLinkAddition: Hashable, Sendable {
    public var created: [UUID] = []
    public var replaced: [UUID] = []
    public var newExercises: [UUID] = []

    public init(created: [UUID] = [], replaced: [UUID] = [], newExercises: [UUID] = []) {
        self.created = created
        self.replaced = replaced
        self.newExercises = newExercises
    }

    /// Removes the templates and exercises the addition made and restores the ones it replaced. Every row is a soft
    /// delete or restore, so nothing is lost and each change syncs.
    public func undo(templates: any TemplateRepository, exercises: any ExerciseRepository) async throws {
        for id in created.reversed() {
            try await templates.removeTemplate(id: id)
        }
        for id in replaced {
            try await templates.restoreTemplate(id: id)
        }
        for id in newExercises.reversed() {
            try await exercises.remove(id: id)
        }
    }
}

/// Writes a reviewed `TemplateLinkPlan` through the normal repositories, so every row is one transaction with an
/// outbox entry (DATA-3) and syncs like a template made by hand. A replaced template is soft-deleted first; the new
/// one goes at the end of the list. A write that fails part-way is undone before the error is thrown.
public struct TemplateLinkWriter: Sendable {
    private let templates: any TemplateRepository
    private let exercises: any ExerciseRepository

    public init(templates: any TemplateRepository, exercises: any ExerciseRepository) {
        self.templates = templates
        self.exercises = exercises
    }

    /// Adds the plan's items. `replacing` holds the ids of the items whose existing template is replaced; an item
    /// with an existing template that is not in it is skipped.
    public func add(_ plan: TemplateLinkPlan, replacing: Set<Int>) async throws -> TemplateLinkAddition {
        var addition = TemplateLinkAddition()
        do {
            var made: [String: Exercise] = [:]
            for item in plan.items where item.existingID == nil || replacing.contains(item.id) {
                if let existing = item.existingID {
                    try await templates.removeTemplate(id: existing)
                    addition.replaced.append(existing)
                }
                let template = try await templates.createTemplate(name: item.template.name)
                addition.created.append(template.id)
                for (exercise, source) in zip(item.template.exercises, item.sources) {
                    let library = try await libraryExercise(source, made: &made, addition: &addition)
                    var slot = try await templates.addExercise(library, to: template.id)
                    slot.sets = exercise.sets
                    slot.repRange = exercise.repRange
                    slot.weight = exercise.weight
                    slot.restSeconds = exercise.restSeconds
                    slot.note = exercise.note
                    _ = try await templates.updateExercise(slot)
                }
            }
            return addition
        } catch {
            try? await addition.undo(templates: templates, exercises: exercises)
            throw error
        }
    }

    /// The library row for `source`, created once per name across the whole link.
    private func libraryExercise(
        _ source: LinkedExerciseSource,
        made: inout [String: Exercise],
        addition: inout TemplateLinkAddition
    ) async throws -> Exercise {
        let key = ExerciseMatcher.normalizedName(source.name)
        if let exercise = made[key] { return exercise }
        let exercise: Exercise
        switch source {
        case .library(let existing):
            return existing
        case .catalog(let entry):
            exercise = try await exercises.create(fromCatalog: entry)
        case .new(let name, let equipment, let loadMode):
            exercise = try await exercises.create(
                name: name,
                equipment: equipment,
                loadMode: loadMode,
                primary: [],
                secondary: []
            )
        }
        made[key] = exercise
        addition.newExercises.append(exercise.id)
        return exercise
    }
}
