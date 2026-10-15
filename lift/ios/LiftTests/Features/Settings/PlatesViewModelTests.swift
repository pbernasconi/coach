import Foundation
import LiftCore
import Testing

@testable import Lift

/// One test per Action case, plus the state it starts from (TEST-2). Every change is saved at once. Made-up gyms only.
@MainActor
@Suite struct PlatesViewModelTests {
    let gym = InMemoryGymSettings(.standard)

    func makeViewModel(unit: WeightUnit = .kg) async -> PlatesViewModel {
        let vm = PlatesViewModel(gym: gym, unit: unit)
        await vm.run()
        return vm
    }

    @Test func runShowsTheSavedSetupForThePreferredUnit() async {
        gym.setup.lb.bar = 35
        let vm = PlatesViewModel(gym: gym, unit: .lb)
        #expect(vm.state.setup == nil)

        await vm.run()

        #expect(vm.state.kit?.bar == 35)
        #expect(vm.state.unit == .lb)
        #expect(vm.state.canReset)
    }

    @Test func unitShownSwitchesTheKitAndClosesTheSheet() async {
        let vm = await makeViewModel()
        vm.send(.plateTapped(25))

        let task = vm.send(.unitShown(.lb))

        #expect(task == nil)
        #expect(vm.state.kit == .standard(.lb))
        #expect(vm.state.plateEditor == nil)
    }

    @Test func barSelectedSavesTheBar() async {
        let vm = await makeViewModel()

        vm.send(.barSelected(15))

        #expect(gym.setup.kg.bar == 15)
        #expect(vm.state.kit?.bar == 15)
        #expect(gym.setup.lb == .standard(.lb))
    }

    @Test func collarSelectedSavesTheCollars() async {
        let vm = await makeViewModel(unit: .lb)

        vm.send(.collarSelected(5.5))

        #expect(gym.setup.lb.collar == 5.5)
        #expect(gym.setup.plateSet(.lb).bar == 56)
    }

    @Test func plateTappedOpensItsSheet() async {
        let vm = await makeViewModel()

        vm.send(.plateTapped(2))
        vm.send(.plateTapped(3))  // no such plate: nothing changes

        #expect(vm.state.plateEditor == PlateEditor(unit: .kg, plate: GymPlate(size: 2, isAvailable: false, pairs: 2)))
    }

    @Test func plateAvailabilityToggledSavesAndUpdatesTheSheet() async {
        let vm = await makeViewModel()
        vm.send(.plateTapped(25))

        vm.send(.plateAvailabilityToggled(false))

        #expect(gym.setup.kg.plates.first { $0.size == 25 }?.isAvailable == false)
        #expect(vm.state.plateEditor?.plate.isAvailable == false)
        #expect(!gym.setup.plateSet(.kg).plates.contains(25))
    }

    @Test func platePairsChangedSavesWithinTheRange() async {
        let vm = await makeViewModel()
        vm.send(.plateTapped(20))

        vm.send(.platePairsChanged(6))
        #expect(gym.setup.kg.plates.first { $0.size == 20 }?.pairs == 6)
        #expect(vm.state.plateEditor?.plate.pairs == 6)

        vm.send(.platePairsChanged(0))
        #expect(gym.setup.kg.plates.first { $0.size == 20 }?.pairs == GymPlate.pairRange.lowerBound)
    }

    @Test func plateEditorDismissedClosesTheSheet() async {
        let vm = await makeViewModel()
        vm.send(.plateTapped(20))

        vm.send(.plateEditorDismissed)

        #expect(vm.state.plateEditor == nil)
    }

    @Test func resetTappedRestoresTheDefaultsAndOffersUndo() async {
        gym.setup.kg.bar = 15
        gym.setup.lb.bar = 35
        let vm = await makeViewModel()
        let changed = gym.setup.kg

        vm.send(.resetTapped)

        #expect(gym.setup.kg == .standard(.kg))
        #expect(gym.setup.lb.bar == 35)  // only the shown unit
        #expect(vm.state.toast == PlatesToast(serial: 1, previous: changed))
        #expect(!vm.state.canReset)
        vm.send(.resetTapped)  // already the defaults: no second toast
        #expect(vm.state.toast?.serial == 1)
    }

    @Test func resetUndoTappedPutsTheKitBack() async throws {
        gym.setup.kg.collar = 2.5
        let vm = await makeViewModel()
        vm.send(.resetTapped)
        let previous = try #require(vm.state.toast?.previous)

        vm.send(.resetUndoTapped(previous))

        #expect(gym.setup.kg.collar == 2.5)
        #expect(vm.state.kit?.collar == 2.5)
    }
}
