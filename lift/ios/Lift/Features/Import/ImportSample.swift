import Foundation

/// Made-up notes in the Apple Notes shape the importer reads. Not anyone's real log (TEST-8).
nonisolated enum ImportSample {
    /// The short example on the paste step: a title line with a date, an exercise, then one line per set.
    static let format = """
        Workout A - Oct 6
        Goblet squat
        - [x] 10 x 20kg
        - [x] 10 x 20kg
        """

    /// The note `-open import` pre-fills in demo mode: two workouts, a warm-up, a name the library does not know,
    /// a skipped set and a line before the first title, so the review step shows every kind of row.
    static let note = """
        Gym notebook
        Workout A - Oct 6
        Warmup: 5 min bike
        3x 60kg x 5reps x squat
        - [x] 5 x 60kg
        - [x] 5 x 60kg
        - [ ] 5 x 60kg
        —
        Dumbbell bench press
        - [x] 10 x 2x 20kg
        - [x] 9 x 2x 20kg
        next time 22kg
        —
        Landmine rotation
        - [x] 12 @ 10kg
        - [x] 12 @ 10kg
        Workout B - Oct 9
        Romanian deadlift - barbell
        - [x] 8 @ 70kg
        - [x] 8 @ 70kg
        —
        8 pull-ups
        - [x] 8
        - [x] 7
        """
}
