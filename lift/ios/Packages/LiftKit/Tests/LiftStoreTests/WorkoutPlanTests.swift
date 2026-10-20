import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// Sessions planned from templates, with targets from progression (README product rules, TEST-5).
@Suite struct WorkoutPlanTests {
    private static let thursday = Fixtures.monday.adding(days: 3)

    /// A "Lower A" template: squat 3 × 5 at 80 kg, then dumbbell bench 2 × 8–12 with no load.
    private func lowerA(_ store: TestStore) async throws -> DayTemplate {
        _ = try await store.exercises.installLibrary()
        let template = try await store.templates.createTemplate(name: "Lower A")
        var squat = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        squat.sets = 3
        squat.repRange = 5...5
        squat.weight = .kg(80)
        _ = try await store.templates.updateExercise(squat)
        var bench = try await store.templates.addExercise(Fixtures.dumbbellBench, to: template.id)
        bench.sets = 2
        _ = try await store.templates.updateExercise(bench)
        try await store.drainOutbox()
        var stream = store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        return try #require(await stream.next() ?? nil)
    }

    private func detail(_ id: UUID, _ store: TestStore) async throws -> SessionDetail {
        var stream = store.sessions.observeSession(id: id).makeAsyncIterator()
        return try #require(await stream.next() ?? nil)
    }

    @Test func aSessionFromATemplateHasItsExercisesAndSets() async throws {
        let store = try TestStore.make()
        let template = try await lowerA(store)
        let session = try await store.plans.createSession(from: template.id, on: Self.thursday, unit: .kg)
        #expect(session.title == "Lower A")
        #expect(session.templateID == template.id)
        let detail = try await detail(session.id, store)
        #expect(detail.items.map(\.exercise.displayName) == [Fixtures.squat.name, Fixtures.dumbbellBench.name])
        #expect(detail.items.map(\.exercise.loadMode) == [.total, .perHand])
        #expect(detail.items.map(\.exercise.restSeconds) == [120, 120])
        #expect(detail.items.map(\.sets.count) == [3, 2])
        #expect(detail.items[0].sets.allSatisfy { $0.target == SetTarget(reps: 5, weight: .kg(80)) })
        #expect(detail.items[1].sets.allSatisfy { $0.target == SetTarget(repRange: 8...12) })
        #expect(detail.items.flatMap(\.sets).allSatisfy { $0.status == .planned })
        let entities = try await store.pendingOutbox().map(\.entity)
        #expect(entities.filter { $0 == .session }.count == 1)
        #expect(entities.filter { $0 == .sessionExercise }.count == 2)
        #expect(entities.filter { $0 == .set }.count == 5)
    }

    @Test(arguments: [
        ([5, 5, 5], 102.5 as Double),  // every set hit the target: one increment more
        ([5, 4, 4], 100.0),  // not yet: the same load again
    ])
    func theLoadGoesUpOnceItWasEarned(reps: [Int], expected: Double) async throws {
        let store = try TestStore.make()
        _ = try await store.loggedSquats(reps: reps, weight: .kg(100))
        let template = try await lowerA(store)
        let session = try await store.plans.createSession(from: template.id, on: Self.thursday, unit: .kg)
        let squat = try #require(try await detail(session.id, store).items.first)
        #expect(squat.sets.map(\.target.weight) == Array(repeating: .kg(expected), count: 3))
    }

    @Test(arguments: [
        (Self.thursday, 102.5 as Double),  // 3 days later: the normal step up
        (Fixtures.monday.adding(days: 14), 90.0),  // 2 weeks later: about 90% of the last load
    ])
    func aSessionAfterABreakStartsLighter(day: LocalDay, expected: Double) async throws {
        let store = try TestStore.make()
        _ = try await store.loggedSquats(reps: [5, 5, 5], weight: .kg(100))
        let template = try await lowerA(store)
        let session = try await store.plans.createSession(from: template.id, on: day, unit: .kg)
        let squat = try #require(try await detail(session.id, store).items.first)
        #expect(squat.sets.map(\.target) == Array(repeating: SetTarget(reps: 5, weight: .kg(expected)), count: 3))
    }

    @Test func theIncreaseIsAStepThePlatesCanMake() async throws {
        var gym = GymSetup.standard
        for index in gym.kg.plates.indices where gym.kg.plates[index].size < 5 {
            gym.kg.plates[index].isAvailable = false  // no plate under 5 kg: 10 kg jumps
        }
        let store = try TestStore.make(gym: gym)
        _ = try await store.loggedSquats(reps: [5, 5, 5], weight: .kg(100))
        let template = try await lowerA(store)
        let session = try await store.plans.createSession(from: template.id, on: Self.thursday, unit: .kg)
        let squat = try #require(try await detail(session.id, store).items.first)
        #expect(squat.sets.map(\.target.weight) == Array(repeating: .kg(110), count: 3))
    }

    @Test func aRemovedTemplateCannotPlanASession() async throws {
        let store = try TestStore.make()
        let template = try await lowerA(store)
        try await store.templates.removeTemplate(id: template.id)
        await #expect(throws: AppError(.notFound, detail: "template \(template.id)")) {
            try await store.plans.createSession(from: template.id, on: Self.thursday, unit: .kg)
        }
    }

    @Test func addExerciseBringsItsSets() async throws {
        let store = try TestStore.make()
        _ = try await store.loggedSquats(reps: [5, 5], weight: .kg(100))
        let session = try await store.sessions.createSession(
            on: Self.thursday,
            title: "Workout",
            unit: .kg,
            templateID: nil
        )
        let added = try await store.plans.addExercise(Fixtures.squat, to: session.id)
        let item = try #require(try await detail(session.id, store).items.first)
        #expect(item.id == added.id)
        #expect(item.sets.map(\.target) == Array(repeating: SetTarget(reps: 5, weight: .kg(102.5)), count: 2))
    }

    @Test func changeTemplateSwapsTheExercisesAndUndoPutsThemBack() async throws {
        let store = try TestStore.make()
        let lower = try await lowerA(store)
        let upper = try await store.templates.createTemplate(name: "Upper A")
        _ = try await store.templates.addExercise(ExerciseLibrary.seed[9], to: upper.id)
        let session = try await store.plans.createSession(from: lower.id, on: Self.thursday, unit: .kg)
        let before = try await detail(session.id, store)

        let undo = try await store.plans.changeTemplate(of: session.id, to: upper.id)
        let changed = try await detail(session.id, store)
        #expect(changed.session.title == "Upper A")
        #expect(changed.session.templateID == upper.id)
        #expect(changed.items.map(\.exercise.exerciseID) == [ExerciseLibrary.seed[9].id])
        #expect(undo.removedExerciseIDs == before.items.map(\.id))

        try await store.plans.undo(undo)
        let restored = try await detail(session.id, store)
        #expect(restored.session.title == "Lower A")
        #expect(restored.session.templateID == lower.id)
        #expect(restored.items.map(\.id) == before.items.map(\.id))
        #expect(restored.items.map(\.sets) == before.items.map(\.sets))
    }

    @Test func aSessionWithALoggedSetCannotChange() async throws {
        let store = try TestStore.make()
        let session = try await store.loggedSquats(reps: [5], weight: .kg(100))
        let template = try await lowerA(store)
        await #expect(throws: AppError(.conflict, detail: "session \(session.id) has logged sets")) {
            try await store.plans.changeTemplate(of: session.id, to: template.id)
        }
    }

    @Test func planNextWeekCopiesTemplateDaysAndSkipsTakenDays() async throws {
        let store = try TestStore.make()
        let lower = try await lowerA(store)
        let upper = try await store.templates.createTemplate(name: "Upper A")
        _ = try await store.plans.createSession(from: lower.id, on: Fixtures.monday, unit: .kg)
        _ = try await store.plans.createSession(from: upper.id, on: Self.thursday, unit: .kg)
        _ = try await store.sessions.createSession(
            on: Fixtures.monday.adding(days: 2),
            title: "Run",
            unit: .kg,
            templateID: nil
        )
        _ = try await store.sessions.createSession(
            on: Self.thursday.adding(days: 7),
            title: "Busy",
            unit: .kg,
            templateID: nil
        )

        let plan = try await store.plans.planNextWeek(from: Fixtures.monday)
        #expect(plan.sessionIDs.count == 1)
        var stream = store.sessions.observeSessions(
            from: Fixtures.monday.adding(days: 7),
            through: Fixtures.monday.adding(days: 13)
        )
        .makeAsyncIterator()
        let next = await stream.next() ?? []
        #expect(next.map(\.session.title) == ["Lower A", "Busy"])
        #expect(next.first?.session.day == Fixtures.monday.adding(days: 7))
        #expect(next.first?.items.count == 2)

        try await store.plans.undo(plan)
        #expect(await stream.next()?.map(\.session.title) == ["Busy"])
    }

    @Test func planningAWeekWithNoTemplateDaysCreatesNothing() async throws {
        let store = try TestStore.make()
        _ = try await store.loggedSquats(reps: [5], weight: .kg(100))
        let plan = try await store.plans.planNextWeek(from: Fixtures.monday)
        #expect(plan.sessionIDs.isEmpty)
        #expect(try await store.pendingOutbox().isEmpty)
    }
}
