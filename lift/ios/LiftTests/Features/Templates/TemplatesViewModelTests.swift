import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct TemplatesViewModelTests {
    let router = RecordingNavigator()
    let upper = DayTemplate(
        id: IDSequence.id(1, prefix: 0xD1),
        name: "Upper A",
        exercises: [
            TemplateExercise(
                id: IDSequence.id(1, prefix: 0xD2),
                exerciseID: Fixtures.squat.id,
                displayName: "Back squat"
            )
        ],
        position: 0,
        createdAt: ManualNow.start,
        updatedAt: ManualNow.start
    )

    func loaded(_ templates: FakeTemplateRepository) async -> TemplatesViewModel {
        let vm = TemplatesViewModel(templates: templates, router: router)
        await vm.run()
        return vm
    }

    @Test func runListsTheTemplates() async {
        let vm = await loaded(FakeTemplateRepository(emissions: [[upper]]))

        let item = TemplateItem(
            id: upper.id,
            name: "Upper A",
            exercises: "Back squat",
            size: TemplateText.size(exercises: 1, sets: 3)
        )
        #expect(vm.state.templates == .loaded([item]))
    }

    @Test func runWithNoTemplatesIsEmpty() async {
        let vm = await loaded(FakeTemplateRepository(emissions: [[]]))

        #expect(vm.state.templates == .empty)
    }

    @Test func templateTappedOpensTheEditor() async {
        let vm = await loaded(FakeTemplateRepository(emissions: [[upper]]))

        #expect(vm.send(.templateTapped(upper.id)) == nil)
        #expect(router.opened == [.template(upper.id)])
    }

    @Test func newTemplateTappedCreatesOneAndOpensIt() async {
        let templates = FakeTemplateRepository(emissions: [[upper]])
        let vm = await loaded(templates)

        let first = vm.send(.newTemplateTapped)
        let second = vm.send(.newTemplateTapped)  // a double tap makes one template
        await first?.value

        #expect(second == nil)
        #expect(templates.calls == [.create(String(localized: "New template"))])
        #expect(router.opened == [.template(FakeTemplateRepository.newID)])
    }

    @Test func optionsTappedOpensTheTemplatesOptions() async {
        let vm = await loaded(FakeTemplateRepository(emissions: [[upper]]))

        vm.send(.optionsTapped(upper.id))

        #expect(vm.state.options?.id == upper.id)
    }

    @Test func optionsDismissedClosesThem() async {
        let vm = await loaded(FakeTemplateRepository(emissions: [[upper]]))
        vm.send(.optionsTapped(upper.id))

        vm.send(.optionsDismissed)

        #expect(vm.state.options == nil)
    }

    @Test func removeTappedRemovesAtOnceAndOffersUndo() async {
        let templates = FakeTemplateRepository(emissions: [[upper]])
        let vm = await loaded(templates)
        vm.send(.optionsTapped(upper.id))

        await vm.send(.removeTapped(upper.id))?.value

        #expect(vm.state.options == nil)
        #expect(templates.calls == [.remove(upper.id)])
        #expect(vm.state.toast == TemplatesToast(serial: 1, kind: .removed(upper.id, name: "Upper A")))
    }

    @Test func undoRemoveTappedRestoresTheTemplate() async {
        let templates = FakeTemplateRepository(emissions: [[upper]])
        let vm = await loaded(templates)

        await vm.send(.undoRemoveTapped(upper.id))?.value

        #expect(templates.calls == [.restore(upper.id)])
        #expect(vm.state.toast == nil)
    }

    @Test func aFailedWriteSaysSo() async {
        let templates = FakeTemplateRepository(emissions: [[upper]], error: AppError(.unknown))
        let vm = await loaded(templates)

        await vm.send(.removeTapped(upper.id))?.value

        #expect(vm.state.toast == TemplatesToast(serial: 1, kind: .failed))
    }

    @Test(arguments: [
        ([String](), "New template"),
        (["New template"], "New template 2"),
        (["New template", "New template 2"], "New template 3"),
    ])
    func newNamesAreUnique(taken: [String], expected: String) {
        #expect(TemplateText.newName(taken: taken) == expected)
    }

    @Test(arguments: [(90, "1:30 rest"), (120, "2 min rest"), (45, "0:45 rest"), (65, "1:05 rest")])
    func restReadsAsMinutes(seconds: Int, expected: String) {
        #expect(TemplateText.rest(seconds) == expected)
    }
}
