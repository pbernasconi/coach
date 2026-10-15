import Foundation
import GRDB
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import LiftStore

/// Templates travel like every other row (SYNC.md): pushed with their entity names, pulled without outbox entries.
@Suite struct TemplateSyncTests {
    @Test func templateRowsPushWithTheirEntityNames() async throws {
        let store = try TestStore.make()
        let template = try await store.templates.createTemplate(name: "Upper A")
        _ = try await store.templates.addExercise(Fixtures.dumbbellBench, to: template.id)
        let changes = try await store.outbox.pending(limit: 10).map(PushChange.init(entry:))
        #expect(changes.map(\.entity.rawValue) == ["template", "templateExercise"])
        let slot = try #require(changes.last?.payload)
        #expect(slot["templateID"] == .string(template.id.uuidString))
        #expect(slot["exerciseID"] == .string(Fixtures.dumbbellBench.id.uuidString))
        #expect(slot["setCount"] == .integer(3))
        #expect(slot["createdAt"]?.stringValue?.hasSuffix("Z") == true)
    }

    @Test func pulledTemplatesApplyParentsFirstWithoutOutboxEntries() async throws {
        let remote = try RemoteDevice()
        let template = try await remote.store.templates.createTemplate(name: "Lower A")
        let slot = try await remote.store.templates.addExercise(Fixtures.squat, to: template.id)
        let changes = try await remote.takeChanges()
        let harness = try SyncHarness()
        harness.transport.queuePull(PullResponse(changes: changes.reversed(), cursor: "2", hasMore: false))
        let status = await harness.engine.syncNow()
        #expect(status.phase == .idle)
        var stream = harness.store.templates.observeTemplate(id: template.id).makeAsyncIterator()
        let pulled = try #require(await stream.next() ?? nil)
        #expect(pulled.name == "Lower A")
        #expect(pulled.exercises.map(\.id) == [slot.id])
        #expect(try await harness.pendingCount() == 0)
    }

    @Test func aSlotWithoutItsTemplateWaits() async throws {
        let remote = try RemoteDevice()
        let template = try await remote.store.templates.createTemplate(name: "Lower A")
        _ = try await remote.store.templates.addExercise(Fixtures.squat, to: template.id)
        let slotOnly = try await remote.takeChanges().filter { $0.entity == .templateExercise }
        let harness = try SyncHarness()
        let result = try await harness.syncState.apply(PulledPage(changes: slotOnly, cursor: "1", isFinal: false))
        #expect(result.deferred.count == 1)
        #expect(result.applied == 0)
    }
}
