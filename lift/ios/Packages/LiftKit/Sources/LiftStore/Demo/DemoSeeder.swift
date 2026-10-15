import Foundation
import LiftCore

/// Fills an empty database with the fabricated `DemoPlan` through the normal repositories, so demo mode runs the same
/// code path as real use (TEST-6): the "Upper A" and "Lower A" templates, past sessions logged by hand, and upcoming
/// sessions planned from the templates (so their loads come from progression).
public struct DemoSeeder: Sendable {
    private let exercises: any ExerciseRepository
    private let sessions: any SessionRepository
    private let sets: any SetRepository
    private let templates: any TemplateRepository
    private let plans: any WorkoutPlanRepository

    public init(
        exercises: any ExerciseRepository,
        sessions: any SessionRepository,
        sets: any SetRepository,
        templates: any TemplateRepository,
        plans: any WorkoutPlanRepository
    ) {
        self.exercises = exercises
        self.sessions = sessions
        self.sets = sets
        self.templates = templates
        self.plans = plans
    }

    /// Seeds the library, the templates and the demo sessions around `today`. Returns the session ids in day order.
    @discardableResult
    public func seed(today: LocalDay) async throws -> [UUID] {
        _ = try await exercises.installLibrary()
        let library = Dictionary(uniqueKeysWithValues: ExerciseLibrary.seed.map { ($0.id, $0) })
        var templateIDs: [String: UUID] = [:]
        for day in DemoPlan.days {
            templateIDs[day.title] = try await template(day, library: library)
        }
        var ids: [UUID] = []
        for slot in DemoPlan.slots {
            let day = today.adding(days: slot.dayOffset)
            let templateID = templateIDs[slot.day.title]
            if slot.dayOffset >= 0, let templateID {
                ids.append(try await plans.createSession(from: templateID, on: day, unit: .kg).id)
                continue
            }
            let session = try await sessions.createSession(
                on: day,
                title: slot.day.title,
                unit: .kg,
                templateID: templateID
            )
            for lift in slot.day.lifts {
                guard let exercise = library[ExerciseLibrary.seedID(lift.seedNumber)] else { continue }
                try await log(lift, exercise: exercise, week: slot.week, to: session.id)
            }
            ids.append(session.id)
        }
        return ids
    }

    /// A template for `day`: each lift's sets × reps at its starting load, 2 minutes' rest.
    private func template(_ day: DemoPlan.Day, library: [UUID: Exercise]) async throws -> UUID {
        let template = try await templates.createTemplate(name: day.title)
        for lift in day.lifts {
            guard let exercise = library[ExerciseLibrary.seedID(lift.seedNumber)] else { continue }
            var slot = try await templates.addExercise(exercise, to: template.id)
            slot.sets = lift.sets
            slot.repRange = lift.reps...lift.reps
            slot.weight = .kg(lift.startKg)
            _ = try await templates.updateExercise(slot)
        }
        return template.id
    }

    private func log(_ lift: DemoPlan.Lift, exercise: Exercise, week: Int, to sessionID: UUID) async throws {
        let slot = try await sessions.addExercise(ExerciseSlot(exercise: exercise, restSeconds: 120), to: sessionID)
        let target = SetTarget(reps: lift.reps, weight: .kg(lift.startKg + lift.weeklyStepKg * Double(week)))
        for _ in 0..<lift.sets {
            let set = try await sets.addSet(to: slot.id, kind: .working, target: target)
            _ = try await sets.log(setID: set.id)
        }
    }
}
