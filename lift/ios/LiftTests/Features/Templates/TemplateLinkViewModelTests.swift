import Foundation
import KoboPatterns
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The template link review: one test per Action (SCR-1), plus reading the link. Fabricated links only (TEST-8).
@MainActor
@Suite struct TemplateLinkViewModelTests {
    let flow = RecordingTemplateLinkFlow()
    let catalog = FakeExerciseCatalog(entries: [
        FakeExerciseCatalog.entry(
            "0841",
            "Weighted Pull-Up",
            bodyPart: "back",
            equipment: "body weight",
            target: "lats"
        )
    ])

    func store() async throws -> TestStore {
        let store = try TestStore.make()
        _ = try await store.exercises.installLibrary()
        return store
    }

    func viewModel(_ store: TestStore, payload: String = TemplateLinkSamples.encoded) -> TemplateLinkViewModel {
        TemplateLinkViewModel(
            request: TemplateLinkRequest(id: 1, payload: payload),
            templates: store.templates,
            exercises: store.exercises,
            catalog: catalog,
            flow: flow
        )
    }

    func templates(_ store: TestStore) async -> [DayTemplate] {
        for await templates in store.templates.observeTemplates() { return templates }
        return []
    }

    @Test func runListsTheTemplatesWithLibraryNamesAndNewExercises() async throws {
        let vm = viewModel(try await store())
        await vm.run()
        let review = try #require(vm.state.review)
        #expect(review.templates.map(\.name) == ["Test day A", "Test day B"])
        #expect(review.templates[0].exercises.map(\.name) == ["Back squat", "Romanian deadlift"])
        #expect(review.templates[0].exercises[0].value == "3 × 8 @ 135 lb · 3 min rest")
        #expect(review.templates[0].detail == "2 exercises · 6 sets · lb")
        #expect(review.newExercises.map(\.name) == ["Sample carry"])
        #expect(review.addCount == 2)
    }

    @Test func runResolvesCatalogNames() async throws {
        let payload = TemplateLinkSamples.base64url(
            #"{"v":1,"unit":"lb","templates":[{"name":"Pull","exercises":[{"name":"weighted pull-ups","weight":10}]}]}"#
        )
        let vm = viewModel(try await store(), payload: payload)
        await vm.run()
        #expect(vm.state.review?.templates.first?.exercises.first?.name == "Weighted Pull-Up")
        #expect(vm.state.review?.newExercises.map(\.name) == ["Weighted Pull-Up"])
    }

    @Test(arguments: [
        ("", TemplateLinkProblem.unreadable),
        ("bm90IGpzb24", .unreadable),
        (TemplateLinkSamples.base64url(#"{"v":2,"templates":[]}"#), .newerVersion),
        (TemplateLinkSamples.base64url(#"{"v":1,"templates":[]}"#), .empty),
        (String(repeating: "A", count: TemplateLink.maximumEncodedLength + 1), .tooLarge),
    ])
    func runExplainsALinkThatCannotBeAdded(payload: String, problem: TemplateLinkProblem) async throws {
        let store = try await store()
        let vm = viewModel(store, payload: payload)
        await vm.run()
        #expect(vm.state.phase == .failed(problem))
        #expect(await templates(store).isEmpty)
    }

    @Test func replaceToggledSwitchesOnlyTemplatesWhoseNameExists() async throws {
        let store = try await store()
        _ = try await store.templates.createTemplate(name: "Test day A")
        let vm = viewModel(store)
        await vm.run()
        #expect(vm.state.review?.addCount == 1)

        vm.send(.replaceToggled(0))
        #expect(vm.state.review?.templates[0].replaces == true)
        #expect(vm.state.review?.addCount == 2)

        vm.send(.replaceToggled(1))
        #expect(vm.state.review?.templates[1].replaces == false)
        vm.send(.replaceToggled(0))
        #expect(vm.state.review?.addCount == 1)
    }

    @Test func addTappedWritesTheTemplatesAndFinishesWithTheAddition() async throws {
        let store = try await store()
        let mine = try await store.templates.createTemplate(name: "Test day A")
        let vm = viewModel(store)
        await vm.run()
        vm.send(.replaceToggled(0))

        await vm.send(.addTapped)?.value

        #expect(vm.state.submit.phase == .ready)
        #expect(await templates(store).map(\.name) == ["Test day A", "Test day B"])
        let finish = try #require(flow.finishes.first)
        #expect(finish.count == 2)
        #expect(finish.addition.replaced == [mine.id])
        #expect(finish.addition.created.count == 2)
        #expect(vm.send(.addTapped) == nil)  // once added, a second tap does nothing
    }

    @Test func addTappedThatFailsKeepsTheReviewOpenWithTheReason() async throws {
        let store = try await store()
        let vm = TemplateLinkViewModel(
            request: TemplateLinkRequest(id: 1, payload: TemplateLinkSamples.encoded),
            templates: FakeTemplateRepository(error: AppError(.unknown, detail: "test")),
            exercises: store.exercises,
            catalog: catalog,
            flow: flow
        )
        await vm.run()

        await vm.send(.addTapped)?.value

        #expect(vm.state.submit.phase == .failed(message: "The templates could not be added. Try again."))
        #expect(vm.state.review != nil)
        #expect(flow.finishes.isEmpty)
    }

    @Test func addTappedWithEveryTemplateSkippedDoesNothing() async throws {
        let store = try await store()
        _ = try await store.templates.createTemplate(name: "Test day A")
        _ = try await store.templates.createTemplate(name: "Test day B")
        let vm = viewModel(store)
        await vm.run()

        #expect(vm.send(.addTapped) == nil)
        #expect(flow.finishes.isEmpty)
    }

    @Test func cancelTappedClosesWithoutWriting() async throws {
        let store = try await store()
        let vm = viewModel(store)
        await vm.run()

        vm.send(.cancelTapped)

        #expect(flow.cancels == 1)
        #expect(flow.finishes.isEmpty)
        #expect(await templates(store).isEmpty)
    }
}

extension TemplateLinkState {
    /// The review, when the link was read.
    var review: TemplateLinkReview? {
        guard case .review(let review) = phase else { return nil }
        return review
    }
}
