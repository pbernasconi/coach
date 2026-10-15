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

    /// Seeds the library, the templates and the demo sessions around `today`. Past sessions are finished, with made-up
    /// start, finish and set times on their day in `calendar`. Returns the session ids in day order.
    @discardableResult
    public func seed(today: LocalDay, calendar: Calendar) async throws -> [UUID] {
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
            let session = try await logged(slot, on: day, templateID: templateID, library: library, calendar: calendar)
            ids.append(session)
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

    /// A past session as if it had been logged live and finished: each set stamped at its made-up time
    /// (`DemoPlan.Pace`) from the slot's start on `day`.
    private func logged(
        _ slot: DemoPlan.Slot,
        on day: LocalDay,
        templateID: UUID?,
        library: [UUID: Exercise],
        calendar: Calendar
    ) async throws -> UUID {
        let start = (day.startDate(in: calendar) ?? .distantPast).addingTimeInterval(Double(slot.startMinute) * 60)
        var times = DemoSetTimes(start: start)
        let lifts = slot.day.lifts.compactMap { lift in
            library[ExerciseLibrary.seedID(lift.seedNumber)].map { exercise in
                (exercise, Self.sets(lift, week: slot.week, times: &times))
            }
        }
        let session = try await sessions.createImportedSession(
            Session(
                id: Self.placeholderID,
                date: day,
                title: slot.day.title,
                templateID: templateID,
                startedAt: start,
                finishedAt: times.finish,
                unitsAtLog: .kg,
                createdAt: start,
                updatedAt: start
            )
        )
        for (exercise, logged) in lifts {
            let slot = try await sessions.addExercise(
                ExerciseSlot(exercise: exercise, restSeconds: 120),
                to: session.id
            )
            for set in logged {
                _ = try await sets.addImported(set, to: slot.id, completedAt: set.actual?.completedAt)
            }
        }
        return session.id
    }

    /// One lift's done sets in week `week` of the block, each stamped by `times`.
    private static func sets(_ lift: DemoPlan.Lift, week: Int, times: inout DemoSetTimes) -> [LoggedSet] {
        let weight = Weight.kg(lift.startKg + lift.weeklyStepKg * Double(week))
        return (0..<lift.sets).map { index in
            LoggedSet(
                id: placeholderID,
                target: SetTarget(reps: lift.reps, weight: weight),
                actual: SetActual(reps: lift.reps, weight: weight, completedAt: times.next(newLift: index == 0))
            )
        }
    }

    /// The id passed with values the repositories give their own ids to.
    private static let placeholderID = UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))
}

/// The made-up clock of a demo session: each set's time from the start, at `DemoPlan.Pace`.
private struct DemoSetTimes {
    let start: Date
    private var last: Date?

    init(start: Date) {
        self.start = start
    }

    /// The next set's time: after the warm-up for the first set, then a set or a lift change after the last one.
    mutating func next(newLift: Bool) -> Date {
        let time =
            last.map { $0.addingTimeInterval(newLift ? DemoPlan.Pace.betweenLifts : DemoPlan.Pace.betweenSets) }
            ?? start.addingTimeInterval(DemoPlan.Pace.warmUp)
        last = time
        return time
    }

    /// The finish: the cool-down after the last set.
    var finish: Date { (last ?? start).addingTimeInterval(DemoPlan.Pace.coolDown) }
}
