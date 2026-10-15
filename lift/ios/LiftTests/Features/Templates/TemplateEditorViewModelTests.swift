import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case, plus `run()` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct TemplateEditorViewModelTests {
    let router = RecordingNavigator()
    let squat = TemplateExercise(
        id: IDSequence.id(1, prefix: 0xD2),
        exerciseID: Fixtures.squat.id,
        displayName: "Back squat",
        sets: 3,
        repRange: 5...5,
        weight: .kg(80),
        restSeconds: 180
    )
    let bench = TemplateExercise(
        id: IDSequence.id(2, prefix: 0xD2),
        exerciseID: Fixtures.dumbbellBench.id,
        displayName: "Bench"
    )

    var template: DayTemplate {
        DayTemplate(
            id: IDSequence.id(1, prefix: 0xD1),
            name: "Lower A",
            exercises: [squat, bench],
            position: 0,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
    }

    func loaded(_ templates: FakeTemplateRepository? = nil) async -> (TemplateEditorViewModel, FakeTemplateRepository) {
        let templates = templates ?? FakeTemplateRepository(emissions: [[template]])
        let vm = TemplateEditorViewModel(templateID: template.id, templates: templates, router: router, unit: .kg)
        await vm.run()
        return (vm, templates)
    }

    @Test func runShowsTheNameAndTheSlotsInOrder() async {
        let (vm, _) = await loaded()

        #expect(vm.state.name == "Lower A")
        guard case .loaded(let overview) = vm.state.template else {
            Issue.record("expected the template")
            return
        }
        #expect(overview.slots.map(\.number) == [1, 2])
        #expect(overview.slots.map(\.name) == ["Back squat", "Bench"])
        #expect(overview.slots[0].detail == "3 × 5 @ 80 kg · 3 min rest")
    }

    @Test func runWithoutTheTemplateIsEmpty() async {
        let (vm, _) = await loaded(FakeTemplateRepository(emissions: [[]]))

        #expect(vm.state.template == .empty)
    }

    @Test func nameChangedEditsTheField() async {
        let (vm, templates) = await loaded()

        vm.send(.nameChanged("Lower B"))

        #expect(vm.state.name == "Lower B")
        #expect(templates.calls.isEmpty)
    }

    @Test func nameCommittedSavesAChangedName() async {
        let (vm, templates) = await loaded()
        vm.send(.nameChanged("  Lower B "))

        await vm.send(.nameCommitted)?.value
        vm.send(.nameChanged("   "))
        await vm.send(.nameCommitted)?.value  // blank: back to the stored name, nothing saved

        #expect(templates.calls == [.rename(template.id, "Lower B")])
        #expect(vm.state.name == "Lower A")
    }

    @Test func slotTappedOpensItsEditor() async {
        let (vm, _) = await loaded()

        vm.send(.slotTapped(bench.id))

        #expect(vm.state.editor == SlotEditor(slot: bench, index: 1, count: 2, unit: .kg))
        #expect(vm.state.editor?.canMoveUp == true)
        #expect(vm.state.editor?.canMoveDown == false)
    }

    @Test func addExerciseTappedOpensThePickerForThisTemplate() async {
        let (vm, _) = await loaded()

        #expect(vm.send(.addExerciseTapped) == nil)
        #expect(router.opened == [.exercisePicker(.template(template.id))])
    }

    @Test func editorSetsChangedClampsToTheRange() async {
        let (vm, _) = await loaded()
        vm.send(.slotTapped(squat.id))

        vm.send(.editorSetsChanged(12))

        #expect(vm.state.editor?.values.sets == 10)
        #expect(vm.state.editor?.hasChanges == true)
    }

    @Test func editorRepMinChangedRaisesTheTopToo() async {
        let (vm, _) = await loaded()
        vm.send(.slotTapped(squat.id))

        vm.send(.editorRepMinChanged(8))

        #expect(vm.state.editor?.values.repMin == 8)
        #expect(vm.state.editor?.values.repMax == 8)
    }

    @Test func editorRepMaxChangedLowersTheBottomToo() async {
        let (vm, _) = await loaded()
        vm.send(.slotTapped(bench.id))

        vm.send(.editorRepMaxChanged(6))

        #expect(vm.state.editor?.values.repMin == 6)
        #expect(vm.state.editor?.values.repMax == 6)
    }

    @Test func editorWeightChangedNeverGoesNegative() async {
        let (vm, _) = await loaded()
        vm.send(.slotTapped(squat.id))

        vm.send(.editorWeightChanged(-5))

        #expect(vm.state.editor?.values.weight == 0)
    }

    @Test func editorRestChangedClampsToTheRange() async {
        let (vm, _) = await loaded()
        vm.send(.slotTapped(squat.id))

        vm.send(.editorRestChanged(900))

        #expect(vm.state.editor?.values.rest == 600)
    }

    @Test func editorDoneTappedSavesTheSlot() async {
        let (vm, templates) = await loaded()
        vm.send(.slotTapped(squat.id))
        vm.send(.editorSetsChanged(4))
        vm.send(.editorWeightChanged(0))

        await vm.send(.editorDoneTapped)?.value

        var saved = squat
        saved.sets = 4
        saved.weight = nil
        #expect(vm.state.editor == nil)
        #expect(templates.calls == [.update(saved)])
    }

    @Test func editorDoneTappedWithoutChangesSavesNothing() async {
        let (vm, templates) = await loaded()
        vm.send(.slotTapped(squat.id))

        #expect(vm.send(.editorDoneTapped) == nil)
        #expect(templates.calls.isEmpty)
    }

    @Test func editorDismissedDropsTheChanges() async {
        let (vm, templates) = await loaded()
        vm.send(.slotTapped(squat.id))
        vm.send(.editorSetsChanged(4))

        vm.send(.editorDismissed)

        #expect(vm.state.editor == nil)
        #expect(templates.calls.isEmpty)
    }

    @Test func moveUpTappedSwapsWithThePreviousSlot() async {
        let (vm, templates) = await loaded()

        await vm.send(.moveUpTapped(bench.id))?.value
        #expect(vm.send(.moveUpTapped(squat.id)) == nil)  // already first

        #expect(templates.calls == [.reorder(template.id, [bench.id, squat.id])])
    }

    @Test func moveDownTappedSwapsWithTheNextSlot() async {
        let (vm, templates) = await loaded()
        vm.send(.slotTapped(squat.id))

        await vm.send(.moveDownTapped(squat.id))?.value

        #expect(vm.state.editor == nil)
        #expect(templates.calls == [.reorder(template.id, [bench.id, squat.id])])
    }

    @Test func removeTappedRemovesAtOnceAndOffersUndo() async {
        let (vm, templates) = await loaded()

        await vm.send(.removeTapped(bench.id))?.value

        #expect(templates.calls == [.removeExercise(bench.id)])
        #expect(vm.state.toast == TemplateEditorToast(serial: 1, kind: .removed(bench.id)))
    }

    @Test func removeUndoTappedRestoresTheSlot() async {
        let (vm, templates) = await loaded()

        await vm.send(.removeUndoTapped(bench.id))?.value

        #expect(templates.calls == [.restoreExercise(bench.id)])
    }
}
