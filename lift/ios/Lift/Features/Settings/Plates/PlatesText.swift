import Foundation
import LiftCore

/// Plain labels for the Plates and bars screen: numbers and units.
nonisolated enum PlatesText {
    /// "20 kg", "2.5 kg".
    static func weight(_ value: Double, _ unit: WeightUnit) -> String {
        WorkoutText.weight(Weight(value, unit))
    }

    /// A plate row's value: "4 pairs", "1 pair", or "Off".
    static func plate(_ plate: GymPlate) -> String {
        guard plate.isAvailable else { return String(localized: "Off") }
        return pairs(plate.pairs)
    }

    /// "1 pair", "4 pairs".
    static func pairs(_ count: Int) -> String {
        count == 1 ? String(localized: "1 pair") : String(localized: "\(count) pairs")
    }

    /// A collar row: "None" or "2.5 kg each".
    static func collar(_ value: Double, _ unit: WeightUnit) -> String {
        value > 0 ? String(localized: "\(weight(value, unit)) each") : String(localized: "None")
    }

    /// The plate sheet's title: "25 kg plates".
    static func plateTitle(_ editor: PlateEditor) -> String {
        String(localized: "\(weight(editor.plate.size, editor.unit)) plates")
    }
}
