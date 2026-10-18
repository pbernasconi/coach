import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// Adding a template link's templates, replacing or skipping same-named ones, and Undo (fabricated links only).
@Suite struct TemplateLinkWriterTests {
    /// `TemplateLinkSamples`: "Test day A" in lb and "Test day B" in kg with one exercise new to the library.
    private static let linked = TemplateLinkSamples.templates

    private func harness() async throws -> TestStore {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        return store
    }

    private func plan(_ store: TestStore) async -> TemplateLinkPlan {
        TemplateLinkPlan.make(
            Self.linked,
            library: await first(store.exercises.observeExercises()),
            catalog: [],
            existing: await first(store.templates.observeTemplates())
        )
    }

    private func first<Value: Sendable>(_ stream: AsyncStream<[Value]>) async -> [Value] {
        for await value in stream { return value }
        return []
    }

    @Test func addsEveryTemplateWithItsSlotsAndUnits() async throws {
        let store = try await harness()
        let addition = try await TemplateLinkWriter(templates: store.templates, exercises: store.exercises)
            .add(await plan(store), replacing: [])
        let templates = await first(store.templates.observeTemplates())
        #expect(templates.map(\.name) == ["Test day A", "Test day B"])
        #expect(addition.created == templates.map(\.id))
        let squat = try #require(templates[0].exercises.first)
        #expect(squat.exerciseID == ExerciseLibrary.seedID(1))
        #expect(squat.sets == 3)
        #expect(squat.repRange == 8...8)
        #expect(squat.weight == .lb(135))
        #expect(squat.restSeconds == 180)
        #expect(squat.note == "Made-up cue")
        #expect(templates[0].exercises[1].repRange == 8...10)
        #expect(templates[1].exercises.map(\.displayName) == ["Sample carry", "Plank"])
        #expect(templates[1].exercises[0].weight == .kg(20))
        let carry = try #require(await first(store.exercises.observeExercises()).first { $0.name == "Sample carry" })
        #expect(carry.loadMode == .perHand)
        #expect(addition.newExercises == [carry.id])
    }

    @Test func aSameNamedTemplateIsSkippedUnlessReplaced() async throws {
        let store = try await harness()
        let mine = try await store.templates.createTemplate(name: "test day a")
        let writer = TemplateLinkWriter(templates: store.templates, exercises: store.exercises)

        let skipped = try await writer.add(await plan(store), replacing: [])
        #expect(skipped.replaced.isEmpty)
        #expect(await first(store.templates.observeTemplates()).map(\.name) == ["test day a", "Test day B"])
        try await skipped.undo(templates: store.templates, exercises: store.exercises)

        let replaced = try await writer.add(await plan(store), replacing: [0])
        #expect(replaced.replaced == [mine.id])
        #expect(await first(store.templates.observeTemplates()).map(\.name) == ["Test day A", "Test day B"])
    }

    @Test func undoTakesBackTemplatesAndNewExercisesAndRestoresReplacedOnes() async throws {
        let store = try await harness()
        _ = try await store.templates.createTemplate(name: "Test day A")
        let before = await first(store.exercises.observeExercises()).count
        let addition = try await TemplateLinkWriter(templates: store.templates, exercises: store.exercises)
            .add(await plan(store), replacing: [0])

        try await addition.undo(templates: store.templates, exercises: store.exercises)

        #expect(await first(store.templates.observeTemplates()).map(\.name) == ["Test day A"])
        #expect(await first(store.templates.observeTemplates()).first?.exercises.isEmpty == true)
        #expect(await first(store.exercises.observeExercises()).count == before)
    }

    @Test func aNameUsedTwiceIsCreatedOnce() async throws {
        let store = try await harness()
        let twice = Self.linked.map { template in
            var renamed = template
            renamed.name += " copy"
            return renamed
        }
        let plan = TemplateLinkPlan.make(
            Self.linked + twice,
            library: await first(store.exercises.observeExercises()),
            catalog: [],
            existing: []
        )
        let addition = try await TemplateLinkWriter(templates: store.templates, exercises: store.exercises)
            .add(plan, replacing: [])
        #expect(addition.created.count == 4)
        #expect(addition.newExercises.count == 1)
    }
}
