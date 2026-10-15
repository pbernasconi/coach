import Foundation
import LiftCore

/// Display text for catalog values, which the dataset writes in lower case ("upper legs", "body weight").
nonisolated enum CatalogText {
    /// "upper legs" → "Upper legs".
    static func label(_ value: String) -> String {
        guard let first = value.first else { return value }
        return first.uppercased() + value.dropFirst()
    }

    /// "Glutes · Barbell": the target muscle, then the equipment.
    static func detail(_ entry: CatalogExercise) -> String {
        "\(label(entry.target)) · \(label(entry.equipment))"
    }
}

/// A filter choice: everything, or one value.
nonisolated enum CatalogChoice: Hashable, Sendable, Identifiable {
    case any
    case only(String)

    var id: Self { self }

    /// The value to filter by; nil for `.any`.
    var value: String? {
        if case .only(let value) = self { return value }
        return nil
    }
}
