import Foundation
import Observation

/// The workout under way for the bar above the tab bar (`ActiveWorkoutAccessory`). `WorkoutActivityCenter` keeps it
/// current as it follows the workout, from the first logged set (or Start) until the workout is finished or discarded;
/// the shell reads it.
@Observable
final class UnderwayWorkout {
    /// Nil while no workout is under way.
    var bar: ActiveWorkoutBar?
}
