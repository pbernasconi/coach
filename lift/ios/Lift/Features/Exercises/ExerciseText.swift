import Foundation
import LiftCore

/// Plain names for equipment and muscles, as lists show them.
nonisolated enum ExerciseText {
    static func equipment(_ equipment: Equipment) -> String {
        switch equipment {
        case .barbell: String(localized: "Barbell")
        case .dumbbell: String(localized: "Dumbbell")
        case .kettlebell: String(localized: "Kettlebell")
        case .machine: String(localized: "Machine")
        case .cable: String(localized: "Cable")
        case .bodyweight: String(localized: "Bodyweight")
        case .other: String(localized: "Other")
        }
    }

    // One case per muscle reads clearer than a lookup table.
    // swiftlint:disable:next cyclomatic_complexity
    static func muscle(_ muscle: Muscle) -> String {
        switch muscle {
        case .chest: String(localized: "Chest")
        case .back: String(localized: "Back")
        case .shoulders: String(localized: "Shoulders")
        case .biceps: String(localized: "Biceps")
        case .triceps: String(localized: "Triceps")
        case .quads: String(localized: "Quads")
        case .hamstrings: String(localized: "Hamstrings")
        case .glutes: String(localized: "Glutes")
        case .calves: String(localized: "Calves")
        case .core: String(localized: "Core")
        case .forearms: String(localized: "Forearms")
        }
    }

    /// "Barbell · Quads, Glutes": the equipment, then the primary muscles.
    static func detail(equipment: Equipment, primary: [Muscle]) -> String {
        let muscles = primary.map { muscle($0) }.formatted(.list(type: .and, width: .narrow))
        let tool = ExerciseText.equipment(equipment)
        return muscles.isEmpty ? tool : "\(tool) · \(muscles)"
    }
}
