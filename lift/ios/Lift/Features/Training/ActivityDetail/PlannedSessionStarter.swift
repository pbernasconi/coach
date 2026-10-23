import Foundation
import LiftCore
import LiftStore
import LiftSync

/// "Start workout" on a coach's planned strength workout: a Lift session on the workout's day with the coach's
/// exercises, sets and reps, linked to the workout on the server so both show as one (APP-API.md, "Workout Lift
/// session"). Each name is found as a template link's is: the library, then the catalog, else a new exercise.
@MainActor
struct PlannedSessionStarter {
    let exercises: any ExerciseRepository
    let plans: any WorkoutPlanRepository
    let catalog: any ExerciseCatalogProviding
    let units: any UnitPreference
    let data: any AppDataSource

    /// The new session's id. The link is best effort: without it the server still counts the day's logged sets, and
    /// the session syncs as any other.
    func start(_ workout: AppPlannedWorkout, today: LocalDay) async throws -> UUID {
        let planned = workout.exercises ?? []
        let library = await firstLibrary()
        let entries = (try? await catalog.catalog().entries) ?? []
        var made: [String: Exercise] = [:]
        var items: [CoachExercise] = []
        for exercise in planned {
            let linked = LinkedExercise(name: exercise.name, sets: exercise.sets, repRange: exercise.repRange)
            let found = try await libraryExercise(
                TemplateLinkResolver.resolve(linked, library: library, catalog: entries),
                made: &made
            )
            items.append(CoachExercise(exercise: found, sets: exercise.sets, repRange: exercise.repRange, note: exercise.note))
        }
        let session = try await plans.createSession(
            titled: workout.title,
            on: workout.date.flatMap(Self.day(fromISO:)) ?? today,
            unit: units.unit,
            exercises: items
        )
        await link(session.id, to: workout.id)
        return session.id
    }

    private func link(_ sessionID: UUID, to workoutID: String) async {
        do {
            let body = try JSONEncoder().encode(["sessionId": sessionID.uuidString.lowercased()])
            _ = try await data.put(AppPlannedWorkout.liftSessionPath(workoutID), body: body)
        } catch {
            AppLog.sync.error("Workout not linked to its Lift session: \(String(describing: error), privacy: .public)")
        }
    }

    private func firstLibrary() async -> [Exercise] {
        for await library in exercises.observeExercises() { return library }
        return []
    }

    /// The library row for `source`, made once per name.
    private func libraryExercise(_ source: LinkedExerciseSource, made: inout [String: Exercise]) async throws
        -> Exercise
    {
        let key = ExerciseMatcher.normalizedName(source.name)
        if let exercise = made[key] { return exercise }
        let exercise: Exercise
        switch source {
        case .library(let existing):
            exercise = existing
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
        return exercise
    }

    /// "2026-10-22" as a day; nil for anything else.
    nonisolated static func day(fromISO text: String) -> LocalDay? {
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
        return LocalDay(year: parts[0], month: parts[1], day: parts[2])
    }
}
