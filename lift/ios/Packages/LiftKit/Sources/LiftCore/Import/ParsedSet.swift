import Foundation

/// The numbers and note read from one set line, before units are resolved against the header.
struct ParsedSet: Equatable {
    var reps: Int?
    var weightValue: Double?
    /// Nil when the line gave no unit; the header's unit (or lb) applies then.
    var unit: WeightUnit?
    /// Two dumbbells, or one in each hand: the number is per hand.
    var perHand = false
    /// The number is plates on one side.
    var perSide = false
    var note: String?
}
