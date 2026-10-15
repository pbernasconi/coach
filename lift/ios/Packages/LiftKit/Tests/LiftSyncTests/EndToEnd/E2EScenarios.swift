import Foundation
import LiftCore
import LiftStore
import LiftTesting

/// The workouts the end-to-end scenarios write, with made-up data. Time moves between writes so every row has its
/// own stamp.
extension E2EDevice {
    /// Two fresh phones.
    static func pair() throws -> (E2EDevice, E2EDevice) {
        (try E2EDevice(now: .e2e()), try E2EDevice(now: .e2e()))
    }

    /// Two exercises, a session with both, three sets each; some logged, one edited, one skipped, one deleted,
    /// one exercise renamed.
    func writeWorkout() async throws -> E2EIDs {
        let tick = { now.advance(seconds: 1.5) }
        var ids = E2EIDs()
        let (press, carry) = try await writeExercises()
        ids.exercises = [press.id, carry.id]
        tick()
        let session = try await sessions.createSession(
            on: Fixtures.monday,
            title: "Upper A",
            unit: .kg,
            templateID: nil
        )
        ids.sessions = [session.id]
        var setIDs: [UUID] = []
        for exercise in [press, carry] {
            tick()
            let slot = try await sessions.addExercise(ExerciseSlot(exercise: exercise, restSeconds: 90), to: session.id)
            ids.sessionExercises.insert(slot.id)
            for reps in [8, 6, 5] {
                tick()
                let target = SetTarget(reps: reps, weight: .kg(22.5))
                setIDs.append(try await sets.addSet(to: slot.id, kind: .working, target: target).id)
            }
        }
        ids.sets = Set(setIDs)
        try await editSets(setIDs, tick: tick)
        var renamed = press
        renamed.name = "Made-up incline press"
        _ = try await exercises.update(renamed)
        tick()
        ids.liveSet = setIDs[0]
        return ids
    }

    /// One exercise, a session and `count` sets, then the session moved a week on. Moving it last gives the session
    /// a later sequence number than its children, so a fresh pull meets the slot and sets before their parent and
    /// must carry them across pages.
    func writeVolumeDay(sets count: Int) async throws -> E2EIDs {
        var ids = E2EIDs()
        let exercise = try await exercises.create(
            name: "Made-up row",
            equipment: .cable,
            loadMode: .total,
            primary: [.back],
            secondary: []
        )
        ids.exercises = [exercise.id]
        let session = try await sessions.createSession(
            on: Fixtures.monday,
            title: "Volume day",
            unit: .kg,
            templateID: nil
        )
        ids.sessions = [session.id]
        let slot = try await sessions.addExercise(ExerciseSlot(exercise: exercise), to: session.id)
        ids.sessionExercises = [slot.id]
        for index in 0..<count {
            now.advance(seconds: 0.001)  // accumulates binary rounding error, like a real clock
            let target = SetTarget(reps: 5 + index % 3, weight: .kg(40 + Double(index % 7) * 2.5))
            ids.sets.insert(try await sets.addSet(to: slot.id, kind: .working, target: target).id)
        }
        now.advance(seconds: 1)
        _ = try await sessions.reschedule(session.id, .pushToNextWeek)
        return ids
    }

    /// A template with three library exercises (one edited, the order changed, one removed, the template renamed),
    /// then a session planned from it.
    func writeTemplateDay() async throws -> (ids: E2EIDs, template: UUID, liveSlots: [UUID]) {
        let tick = { now.advance(seconds: 2) }
        var ids = E2EIDs()
        let template = try await templates.createTemplate(name: "Upper A")
        ids.templates = [template.id]
        var slots: [TemplateExercise] = []
        for exercise in [Fixtures.dumbbellBench, Fixtures.squat, ExerciseLibrary.seed[2]] {
            tick()
            slots.append(try await templates.addExercise(exercise, to: template.id))
        }
        ids.templateExercises = Set(slots.map(\.id))
        let (bench, squat, row) = (slots[0], slots[1], slots[2])
        tick()
        var heavier = bench
        heavier.sets = 4
        heavier.weight = .kg(32.5)
        _ = try await templates.updateExercise(heavier)
        tick()
        try await templates.reorderExercises(in: template.id, ids: [squat.id, bench.id, row.id])
        tick()
        try await templates.removeExercise(id: row.id)
        tick()
        try await templates.renameTemplate(id: template.id, to: "Upper A (heavy)")
        tick()
        let session = try await plans.createSession(from: template.id, on: Fixtures.monday, unit: .kg)
        ids.sessions = [session.id]
        (ids.sessionExercises, ids.sets) = try await children(ofSession: session.id)
        return (ids, template.id, [squat.id, bench.id])
    }

    private func writeExercises() async throws -> (Exercise, Exercise) {
        let press = try await exercises.create(
            name: "Made-up press",
            equipment: .dumbbell,
            loadMode: .perHand,
            primary: [.chest],
            secondary: [.triceps]
        )
        now.advance(seconds: 1.5)
        let carry = try await exercises.create(
            name: "Made-up carry",
            equipment: .kettlebell,
            loadMode: .bodyweight(added: .kg(12)),
            primary: [.forearms],
            secondary: []
        )
        return (press, carry)
    }

    /// Logs the first, edits then logs the second, skips the third and deletes the fourth.
    private func editSets(_ ids: [UUID], tick: () -> Void) async throws {
        tick()
        _ = try await sets.log(setID: ids[0])
        tick()
        _ = try await sets.saveValues(setID: ids[1], reps: 7, weight: .kg(24))
        tick()
        _ = try await sets.log(setID: ids[1])
        tick()
        _ = try await sets.skip(setID: ids[2])
        tick()
        try await sets.remove(setID: ids[3])
        tick()
    }
}
