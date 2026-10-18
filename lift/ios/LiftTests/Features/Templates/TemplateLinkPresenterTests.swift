import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The shell's side of a template link: open, close, the "Added" toast and its Undo. Fabricated links only.
@MainActor
@Suite struct TemplateLinkPresenterTests {
    func templates(_ store: TestStore) async -> [DayTemplate] {
        for await templates in store.templates.observeTemplates() { return templates }
        return []
    }

    @Test func eachLinkOpensANewRequestAndCancelClosesIt() throws {
        let store = try TestStore.make()
        let presenter = TemplateLinkPresenter(templates: store.templates, exercises: store.exercises)
        presenter.present(payload: "a")
        let first = try #require(presenter.request)
        presenter.present(payload: "a")
        #expect(presenter.request != first)
        #expect(presenter.request?.payload == "a")

        presenter.cancel()

        #expect(presenter.request == nil)
        #expect(presenter.toast == nil)
    }

    @Test func finishClosesAndAnnouncesTheCount() throws {
        let store = try TestStore.make()
        let presenter = TemplateLinkPresenter(templates: store.templates, exercises: store.exercises)
        presenter.present(payload: "a")

        presenter.finish(TemplateLinkAddition(), count: 2)
        presenter.finish(TemplateLinkAddition(), count: 2)

        #expect(presenter.request == nil)
        #expect(presenter.toast == TemplateLinkToast(serial: 2, kind: .added(count: 2)))
    }

    @Test func undoTakesBackTheLastAdditionOnce() async throws {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        let mine = try await store.templates.createTemplate(name: "Test day A")
        let plan = TemplateLinkPlan.make(TemplateLinkSamples.templates, library: [], catalog: [], existing: [mine])
        let addition = try await TemplateLinkWriter(templates: store.templates, exercises: store.exercises)
            .add(plan, replacing: [0])
        let presenter = TemplateLinkPresenter(templates: store.templates, exercises: store.exercises)
        presenter.finish(addition, count: 2)

        await presenter.undo()
        await presenter.undo()

        #expect(await templates(store).map(\.id) == [mine.id])
        #expect(presenter.toast?.kind == .added(count: 2))
    }

    @Test func aFailedUndoSaysSo() async throws {
        let store = try TestStore.make()
        let presenter = TemplateLinkPresenter(
            templates: FakeTemplateRepository(error: AppError(.unknown, detail: "test")),
            exercises: store.exercises
        )
        presenter.finish(TemplateLinkAddition(created: [IDSequence.id(1, prefix: 0xC1)]), count: 1)

        await presenter.undo()

        #expect(presenter.toast?.kind == .undoFailed)
    }
}
