import Foundation
import LiftCore

/// Made-up values for Store tests (TEST-8). Nothing here comes from a real log.
public enum Fixtures {
    /// The Monday of `ManualNow.start`.
    public static let monday = LocalDay(year: 2026, month: 3, day: 2)

    /// A library lift with a fixed id: Back squat, barbell, total load.
    public static var squat: Exercise { ExerciseLibrary.seed[0] }

    /// A library lift loaded per hand: Dumbbell bench press.
    public static var dumbbellBench: Exercise { ExerciseLibrary.seed[5] }

    /// A plain "3 x 5 at 100 kg" target.
    public static let fiveAt100 = SetTarget(reps: 5, weight: .kg(100))
}
