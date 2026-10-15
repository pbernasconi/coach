import Foundation
import LiftCore
import Observation

@Observable
final class PlatesViewModel {
    private(set) var state: PlatesState

    /// The saved bars, plates and collars.
    private let gym: any GymPreference
    @ObservationIgnored private var serial = 0

    /// Protocols and values only, no defaults, no work (SCR-3). `unit` is the kit shown first.
    init(gym: any GymPreference, unit: WeightUnit) {
        state = PlatesState(unit: unit)
        self.gym = gym
    }

    /// Reads the saved setup (SCR-4).
    func run() async {
        state.setup = gym.setup
    }

    @discardableResult
    func send(_ action: PlatesAction) -> Task<Void, Never>? {
        switch action {
        case .unitShown(let unit):
            state.unit = unit
            state.plateEditor = nil
        case .barSelected(let bar):
            edit(state.unit) { $0.bar = bar }
        case .collarSelected(let collar):
            edit(state.unit) { $0.collar = max(0, collar) }
        case .plateTapped(let size):
            guard let plate = state.kit?.plates.first(where: { $0.size == size }) else { return nil }
            state.plateEditor = PlateEditor(unit: state.unit, plate: plate)
        case .plateAvailabilityToggled(let isOn):
            editPlate { $0.isAvailable = isOn }
        case .platePairsChanged(let pairs):
            editPlate { $0.pairs = min(max(pairs, GymPlate.pairRange.lowerBound), GymPlate.pairRange.upperBound) }
        case .plateEditorDismissed:
            state.plateEditor = nil
        case .resetTapped:
            reset()
        case .resetUndoTapped(let previous):
            edit(previous.unit) { $0 = previous }
        }
        return nil
    }

    /// Puts the shown kit back to the defaults and offers Undo; nothing when it already is.
    private func reset() {
        guard state.canReset, let previous = state.kit else { return }
        edit(state.unit) { $0 = .standard(previous.unit) }
        serial += 1
        state.toast = PlatesToast(serial: serial, previous: previous)
    }

    /// Changes the plate the sheet is open on.
    private func editPlate(_ change: (inout GymPlate) -> Void) {
        guard let editor = state.plateEditor else { return }
        edit(editor.unit) { kit in
            guard let index = kit.plates.firstIndex(where: { $0.size == editor.plate.size }) else { return }
            change(&kit.plates[index])
        }
    }

    /// Changes `unit`'s kit and saves the setup at once.
    private func edit(_ unit: WeightUnit, _ change: (inout BarbellSetup) -> Void) {
        guard var setup = state.setup else { return }
        change(&setup[unit])
        guard setup != state.setup else { return }
        gym.setup = setup
        state.setup = setup
        if let editor = state.plateEditor, let plate = setup[editor.unit].plates.first(where: { $0.id == editor.id }) {
            state.plateEditor?.plate = plate
        }
    }
}
