import Foundation
import LiftCore
import LiftStore

/// The plates behind a set's weight, for the drawing in the set editor: a barbell loaded in total (the bar plus both
/// sides) or a lift written per side (a plate-loaded machine). Other lifts have none.
nonisolated struct EditorPlates: Equatable, Sendable {
    /// What the plates go on.
    enum Holder: Equatable, Sendable {
        /// A barbell; the weight is the bar plus both sides. `bar` is the bar alone, for its label.
        case bar(Double)
        /// One side of a plate-loaded machine; the weight is the plates on one side.
        case sleeve
    }

    var holder: Holder
    /// The gym's plates, in the editor's unit. For a barbell its bar includes the collars.
    var plateSet: PlateSet

    /// The plates for `weight` (in the plate set's unit), heaviest first: the way the bar is loaded.
    func loading(for weight: Double) -> PlateLoading {
        let total = holder == .sleeve ? weight * 2 : weight
        let load = PlateMath.stacked(for: Weight(total, plateSet.unit), using: plateSet)
        return PlateLoading(
            holder: holder,
            perSide: load.perSide,
            loaded: holder == .sleeve ? load.total.value / 2 : load.total.value,
            isExact: load.isExact,
            heaviest: plateSet.stock.filter { $0.pairs != 0 }.map(\.size).max() ?? 0
        )
    }

    /// The plates for a set of `exercise`, or nil when it is not loaded with plates.
    static func make(for exercise: SessionExerciseRecord, unit: WeightUnit, gym: GymSetup) -> Self? {
        let kit = gym[unit]
        switch exercise.loadMode {
        case .total where exercise.equipment == .barbell:
            return EditorPlates(holder: .bar(kit.bar), plateSet: kit.plateSet)
        case .perSide:
            return EditorPlates(holder: .sleeve, plateSet: PlateSet(unit: unit, bar: 0, stock: kit.plateSet.stock))
        default:
            return nil
        }
    }
}

/// The plates one weight needs, as the editor draws and labels them.
nonisolated struct PlateLoading: Equatable, Sendable {
    var holder: EditorPlates.Holder
    /// One side, heaviest (innermost) first.
    var perSide: [Double]
    /// The weight these plates make, in the set's terms (bar and both sides, or one side).
    var loaded: Double
    /// False when the plates cannot make the weight; `loaded` is then the closest below it.
    var isExact: Bool
    /// The heaviest plate the gym has, so plate heights compare across weights.
    var heaviest: Double
}
