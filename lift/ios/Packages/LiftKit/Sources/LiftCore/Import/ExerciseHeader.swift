import Foundation

/// An exercise header line: a name, optionally with a prescription (`3x225lbx5reps x squat lift`).
struct ExerciseHeader: Equatable {
    var name: String
    var plannedSets: Int?
    var reps: Int?
    var repRange: ClosedRange<Int>?
    var weightValue: Double?
    var unit: WeightUnit?
    /// `53*2lbs`: two dumbbells, the number is each.
    var perHand = false
    /// Named explicitly (`Romain deadlift - barbell`, or a lone `Barbell` line under the header).
    var equipment: Equipment?

    /// The prescribed weight, in the header's unit or lb.
    var weight: Weight? { weightValue.map { Weight($0, unit ?? .lb) } }

    /// The target every set of this exercise inherits.
    var target: SetTarget { SetTarget(reps: reps, repRange: repRange, weight: weight) }
}
