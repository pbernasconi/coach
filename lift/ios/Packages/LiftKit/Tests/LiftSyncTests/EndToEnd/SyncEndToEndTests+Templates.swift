import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

extension SyncEndToEndTests {
    /// Day templates (schema v4) and the sessions planned from them.
    @Suite struct Templates {
        @Test func templatesAndSessionsPlannedFromThemSync() async throws {
            let (deviceA, deviceB) = try E2EDevice.pair()
            defer { [deviceA, deviceB].forEach { $0.remove() } }
            let day = try await deviceA.writeTemplateDay()
            let ids = day.ids
            #expect(ids.sessionExercises.count == 2)
            #expect(ids.sets.count >= 4)
            #expect(await deviceA.engine.syncNow().phase == .idle)

            #expect(await deviceB.engine.syncNow().phase == .idle)
            let expected = try await deviceA.snapshot(ids)
            #expect(expected.count == ids.count)
            let pulled = try await deviceB.snapshot(ids)
            #expect(pulled == expected, "\(pulled.differences(from: expected))")
            #expect(try await deviceB.pendingCount() == 0)
            var templatesOnB = deviceB.templates.observeTemplate(id: day.template).makeAsyncIterator()
            let onB = try #require(await templatesOnB.next() ?? nil)
            #expect(onB.name == "Upper A (heavy)")
            #expect(onB.exercises.map(\.id) == day.liveSlots)
            #expect(onB.exercises.last?.sets == 4)

            // B renames it an hour later; A gets it back.
            deviceB.now.advance(seconds: 3600)
            try await deviceB.templates.renameTemplate(id: day.template, to: "Upper B")
            #expect(await deviceB.engine.syncNow().phase == .idle)
            #expect(await deviceA.engine.syncNow().phase == .idle)
            #expect(try await deviceA.snapshot(ids) == deviceB.snapshot(ids))
        }
    }
}
