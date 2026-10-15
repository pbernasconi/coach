import Foundation
import LiftCore

/// Fills an empty database with the fabricated `DemoPlan` through the normal repositories, so demo mode runs
/// the same code path as real use (TEST-6). Past sessions are logged; upcoming ones stay planned.
public struct DemoSeeder: Sendable {
    private let exercises: any ExerciseRepository
    private let sessions: any SessionRepository
    private let sets: any SetRepository

    public init(exercises: any ExerciseRepository, sessions: any SessionRepository, sets: any SetRepository) {
        self.exercises = exercises
        self.sessions = sessions
        self.sets = sets
    }

    /// Seeds the library and the demo sessions around `today`. Returns the session ids in day order.
    @discardableResult
    public func seed(today: LocalDay) async throws -> [UUID] {
        _ = try await exercises.installLibrary()
        let library = Dictionary(uniqueKeysWithValues: ExerciseLibrary.seed.map { ($0.id, $0) })
        var ids: [UUID] = []
        for slot in DemoPlan.slots {
            let session = try await sessions.createSession(
                on: today.adding(days: slot.dayOffset),
                title: slot.day.title,
                unit: .kg,
                templateID: nil
            )
            for lift in slot.day.lifts {
                guard let exercise = library[ExerciseLibrary.seedID(lift.seedNumber)] else { continue }
                try await add(lift, exercise: exercise, week: slot.week, to: session.id, logged: slot.dayOffset < 0)
            }
            ids.append(session.id)
        }
        return ids
    }

    private func add(_ lift: DemoPlan.Lift, exercise: Exercise, week: Int, to sessionID: UUID, logged: Bool)
        async throws
    {
        let slot = try await sessions.addExercise(ExerciseSlot(exercise: exercise, restSeconds: 120), to: sessionID)
        let target = SetTarget(reps: lift.reps, weight: .kg(lift.startKg + lift.weeklyStepKg * Double(week)))
        for _ in 0..<lift.sets {
            let set = try await sets.addSet(to: slot.id, kind: .working, target: target)
            if logged {
                _ = try await sets.log(setID: set.id)
            }
        }
    }
}
