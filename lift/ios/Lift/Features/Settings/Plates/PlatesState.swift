import LiftCore

/// Everything the Plates and bars screen renders: one unit's bar, plates and collars at a time.
nonisolated struct PlatesState: Equatable, Sendable {
    /// The unit whose kit is shown; the preferred unit at first.
    var unit: WeightUnit
    /// The saved setup; nil until `run()` reads it (SCR-4).
    var setup: GymSetup?
    /// The plate whose sheet is open.
    var plateEditor: PlateEditor?
    /// The latest message for the toast slot.
    var toast: PlatesToast?

    init(unit: WeightUnit, setup: GymSetup? = nil, plateEditor: PlateEditor? = nil, toast: PlatesToast? = nil) {
        self.unit = unit
        self.setup = setup
        self.plateEditor = plateEditor
        self.toast = toast
    }

    /// The shown unit's kit.
    var kit: BarbellSetup? { setup?[unit] }

    /// True when the shown kit is not the defaults, so "Reset to defaults" has something to do.
    var canReset: Bool { kit.map { $0 != .standard(unit) } ?? false }
}

/// The plate sheet: the plate it edits, as saved, and its unit. The ViewModel refreshes it after each change, so the
/// open sheet updates in place (same `id`).
nonisolated struct PlateEditor: Equatable, Sendable, Identifiable {
    var unit: WeightUnit
    var plate: GymPlate

    var id: Double { plate.size }
}

/// A short message for the toast slot. `serial` changes with every message, so the same message can show twice.
nonisolated struct PlatesToast: Equatable, Sendable {
    var serial: Int
    /// The kit before "Reset to defaults", for Undo.
    var previous: BarbellSetup
}
