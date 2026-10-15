import Foundation

/// How the logged number maps to the load lifted. Stamped on every logged exercise (DATA-6).
public enum LoadMode: Codable, Hashable, Sendable {
    /// The number is the whole load (a barbell with plates, a machine stack, one dumbbell).
    case total
    /// Two dumbbells or kettlebells; the number is the weight of each one.
    case perHand
    /// The number is the plates on one side of the bar.
    case perSide
    /// Bodyweight, optionally with external load (a belt or vest) on top.
    case bodyweight(added: Weight?)

    /// Whether this is a bodyweight movement, with or without added load.
    public var isBodyweight: Bool {
        if case .bodyweight = self { return true }
        return false
    }
}
