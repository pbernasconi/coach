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
    /// What is loaded now: the weight of the set logged last before this one and its plates (one side, from the
    /// collar outwards); nil before the first set.
    var onBar: Double?
    var onBarPlates: [Double] = []

    /// The plates for `weight` (in the plate set's unit), keeping the plates loaded now where they can stay, and the
    /// change from what is loaded now.
    func loading(for weight: Double) -> PlateLoading {
        let load = plates(for: weight, keeping: onBarPlates)
        return PlateLoading(
            holder: holder,
            perSide: load.perSide,
            change: onBar.map { _ in PlateChange(from: onBarPlates, to: load.perSide) },
            loaded: holder == .sleeve ? load.total.value / 2 : load.total.value,
            isExact: load.isExact,
            onBar: onBar,
            heaviest: plateSet.stock.filter { $0.pairs != 0 }.map(\.size).max() ?? 0
        )
    }

    /// The plates for `weight`, keeping as many of `onBar` (one side) as can stay.
    private func plates(for weight: Double, keeping onBar: [Double]) -> PlateLoad {
        let total = holder == .sleeve ? weight * 2 : weight
        return PlateMath.load(for: Weight(total, plateSet.unit), using: plateSet, from: onBar)
    }

    /// The plates for a set of `exercise`, or nil when it is not loaded with plates. `logged` holds the weights of the
    /// sets logged before this one, in order: each loads on top of the one before, so the plates on the bar now are
    /// the ones the person put on.
    static func make(for exercise: SessionExerciseRecord, unit: WeightUnit, gym: GymSetup, logged: [Weight]) -> Self? {
        let kit = gym[unit]
        var plates: EditorPlates
        switch exercise.loadMode {
        case .total where exercise.equipment == .barbell:
            plates = EditorPlates(holder: .bar(kit.bar), plateSet: kit.plateSet)
        case .perSide:
            plates = EditorPlates(holder: .sleeve, plateSet: PlateSet(unit: unit, bar: 0, stock: kit.plateSet.stock))
        default:
            return nil
        }
        for weight in logged.map({ $0.converted(to: unit).value }) {
            plates.onBarPlates = plates.plates(for: weight, keeping: plates.onBarPlates).perSide
            plates.onBar = weight
        }
        return plates
    }
}

/// The plates one weight needs, as the editor draws and labels them.
nonisolated struct PlateLoading: Equatable, Sendable {
    var holder: EditorPlates.Holder
    /// One side, heaviest (innermost) first.
    var perSide: [Double]
    /// From what is loaded now; nil before the first set.
    var change: PlateChange?
    /// The weight these plates make, in the set's terms (bar and both sides, or one side).
    var loaded: Double
    /// False when the plates cannot make the weight; `loaded` is then the closest below it.
    var isExact: Bool
    /// The weight loaded now, for "from 225".
    var onBar: Double?
    /// The heaviest plate the gym has, so plate heights compare across weights.
    var heaviest: Double
}
