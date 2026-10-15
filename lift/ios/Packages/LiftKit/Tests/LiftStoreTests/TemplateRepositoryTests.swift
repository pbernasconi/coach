import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// Templates and their slots: every write one transaction with an outbox entry per row (DATA-3, TEST-5).
@Suite struct TemplateRepositoryTests {
    private static let bench = Fixtures.dumbbellBench

    @Test func createAddsAnEmptyTemplateAtTheEnd() async throws {
        let store = try TestStore.make()
        let first = try await store.templates.createTemplate(name: "  Upper A ")
        let second = try await store.templates.createTemplate(name: "Lower A")
        #expect(first.name == "Upper A")
        #expect(first.exercises.isEmpty)
        #expect(first.position == 0)
        #expect(second.position == 1)
        let entries = try await store.pendingOutbox()
        #expect(entries.map(\.entity) == [.template, .template])
        #expect(entries.map(\.op) == [.insert, .insert])
        var stream = store.templates.observeTemplates().makeAsyncIterator()
        #expect(await stream.next()?.map(\.name) == ["Upper A", "Lower A"])
    }

    @Test func blankNamesAreRejected() async throws {
        let store = try TestStore.make()
        await #expect(throws: AppError(.invalidInput, detail: "template name")) {
            try await store.templates.createTemplate(name: "   ")
        }
        #expect(try await store.pendingOutbox().isEmpty)
    }

    @Test func addingAnExerciseUsesTheDefaultsWithoutHistory() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Lower A")
        try await store.drainOutbox()
        let slot = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        #expect(slot.exerciseID == Fixtures.squat.id)
        #expect(slot.displayName == Fixtures.squat.name)
        #expect(slot.sets == 3)
        #expect(slot.repRange == 8...12)
        #expect(slot.restSeconds == 120)
        #expect(try await store.pendingOutbox().map(\.entity) == [.templateExercise])
    }

    @Test func addingAnExerciseRepeatsItsLastSession() async throws {
        let store = try TestStore.make()
        _ = try await store.loggedSquats(reps: [5, 5], weight: .kg(100))
        let template = try await store.templates.createTemplate(name: "Lower A")
        let slot = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        #expect(slot.sets == 2)
        #expect(slot.repRange == 5...5)
    }

    @Test func updateSavesTheSlotAndKeepsItsExercise() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        var slot = try await store.templates.addExercise(Self.bench, to: template.id)
        try await store.drainOutbox()
        slot.sets = 4
        slot.repRange = 6...8
        slot.weight = .kg(24)
        slot.restSeconds = 90
        slot.exerciseID = Fixtures.squat.id
        let saved = try await store.templates.updateExercise(slot)
        #expect(saved.sets == 4)
        #expect(saved.repRange == 6...8)
        #expect(saved.weight == .kg(24))
        #expect(saved.restSeconds == 90)
        #expect(saved.exerciseID == Self.bench.id)
        #expect(try await store.pendingOutbox().map(\.op) == [.update])
        var stream = store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        #expect(await stream.next()??.exercises == [saved])
    }

    @Test func zeroSetsAreRejected() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        var slot = try await store.templates.addExercise(Self.bench, to: template.id)
        slot.sets = 0
        await #expect(throws: AppError(.invalidInput, detail: "template slot")) {
            try await store.templates.updateExercise(slot)
        }
    }

    @Test func removeAndRestoreASlot() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        let slot = try await store.templates.addExercise(Self.bench, to: template.id)
        try await store.drainOutbox()
        var stream = store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        #expect(await stream.next()??.exercises.count == 1)
        try await store.templates.removeExercise(id: slot.id)
        #expect(await stream.next()??.exercises.isEmpty == true)
        try await store.templates.restoreExercise(id: slot.id)
        #expect(await stream.next()??.exercises.map(\.id) == [slot.id])
        #expect(try await store.pendingOutbox().map(\.op) == [.delete, .update])
    }

    @Test func removeAndRestoreATemplate() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        var stream = store.templates.observeTemplates().makeAsyncIterator()
        #expect(await stream.next()?.count == 1)
        try await store.templates.removeTemplate(id: template.id)
        #expect(await stream.next() == [])
        try await store.templates.restoreTemplate(id: template.id)
        #expect(await stream.next()?.map(\.id) == [template.id])
    }

    @Test func renameTrimsAndSaves() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        try await store.templates.renameTemplate(id: template.id, to: " Upper B ")
        var stream = store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        #expect(await stream.next()??.name == "Upper B")
    }

    @Test func reorderWritesOnlyTheSlotsThatMove() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Full")
        let squat = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        let bench = try await store.templates.addExercise(Self.bench, to: template.id)
        let row = try await store.templates.addExercise(ExerciseLibrary.seed[9], to: template.id)
        try await store.drainOutbox()
        try await store.templates.reorderExercises(in: template.id, ids: [bench.id, squat.id, row.id])
        #expect(try await store.pendingOutbox().map(\.rowID) == [bench.id, squat.id])
        var stream = store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        #expect(await stream.next()??.exercises.map(\.id) == [bench.id, squat.id, row.id])
        await #expect(throws: AppError(.invalidInput, detail: "reorder ids")) {
            try await store.templates.reorderExercises(in: template.id, ids: [bench.id, squat.id])
        }
    }

    @Test func saveAsTemplateCopiesTheSessionsLibraryExercises() async throws {
        let store = try TestStore.make()
        let session = try await store.loggedSquats(reps: [5, 5, 5], weight: .kg(100))
        _ = try await store.sessions.addExercise(
            ExerciseSlot(exerciseID: nil, displayName: "Sled push", loadMode: .total, equipment: nil),
            to: session.id
        )
        try await store.drainOutbox()
        let template = try await store.templates.saveAsTemplate(sessionID: session.id, name: "Lower A")
        #expect(template.name == "Lower A")
        #expect(template.exercises.count == 1)
        let slot = try #require(template.exercises.first)
        #expect(slot.exerciseID == Fixtures.squat.id)
        #expect(slot.sets == 3)
        #expect(slot.repRange == 5...5)
        #expect(slot.weight == .kg(100))
        #expect(slot.restSeconds == 120)
        #expect(try await store.pendingOutbox().map(\.entity) == [.template, .templateExercise, .session])
        var stream = store.sessions.observeSession(id: session.id).makeAsyncIterator()
        #expect(await stream.next()??.session.templateID == template.id)
    }

    @Test func slotsShowTheLibrarysCurrentName() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        let template = try await store.templates.createTemplate(name: "Lower A")
        _ = try await store.templates.addExercise(Fixtures.squat, to: template.id)
        var renamed = Fixtures.squat
        renamed.name = "Low-bar squat"
        _ = try await store.exercises.update(renamed)
        var stream = store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        #expect(await stream.next()??.exercises.first?.displayName == "Low-bar squat")
    }
}
