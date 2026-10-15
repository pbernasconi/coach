import Foundation

/// What the lift is done with. Drives the default load increment.
public enum Equipment: String, Codable, Hashable, Sendable, CaseIterable {
    case barbell
    case dumbbell
    case kettlebell
    case machine
    case cable
    case bodyweight
    case other

    /// The smallest sensible jump in load. Dumbbell increments are per hand.
    public func defaultIncrement(in unit: WeightUnit) -> Weight {
        let pair: (lb: Double, kg: Double) =
            switch self {
            case .barbell, .bodyweight, .other: (5, 2.5)
            case .dumbbell: (5, 2)
            case .kettlebell: (9, 4)
            case .machine, .cable: (10, 5)
            }
        return Weight(unit == .lb ? pair.lb : pair.kg, unit)
    }
}
