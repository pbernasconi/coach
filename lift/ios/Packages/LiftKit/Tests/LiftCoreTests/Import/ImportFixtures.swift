import Foundation

/// Made-up notes in the Apple Notes shape. Not anyone's real log (TEST-8).
enum ImportFixtures {
    static let reference = TestCalendar.date(2026, 10, 15)

    /// Two sessions in one paste, with separators inside sessions, a warm-up, a superset, hints and a
    /// dangling equipment line.
    static let twoSessions = """
        Workout A - oct 6
        Warmup
        - [x] 6 min rower
        - [x] 12 mins incline walk += 30 flights
        ——
        3x 185lb x 6reps x squat lift
          - [x] 6 x 185 DEEP SQUAT
            - [x] 6 x 185
        \t- [ ] 6 x 185 - didn't do it
        —-
        Dumbbell bench press
        - [x] 10 x 2x 50lb
        - [x] 9 x 2x50lb slower descent (2 seconds)
        - [x] 8
        next time bump to 55lb
        ——-
        8 pull-ups
        - [x] 8
        - [x] 7
        - [x] 6
        ---
        Superset
        - [x] lateral raise 15 @ 12 + curls 12 @ 20 + OH triceps 12 @ 35, 90s between rounds
        - [x] lateral raise 15 @ 12 + curls 11 @ 20 + OH triceps 10 @ 35
        - [ ] lateral raise 15 @ 12 + curls 10 @ 20 + OH triceps 10 @ 35
        ——
        Workout B- oct 9
        Romain deadlift - barbell
        - [x] 10 @ 135
        - [x] 10 @ 135 the right weight
        go 145 next time
        —-
        3x 40*2lbs x 8reps x Bulgarian split squats
        - [x] 8
        - [x] 8
        - [x] 7
        —-
        Kettle bell hip swing
        - [x] 15 @ 35
        - [x] 15 @ 35
        ---
        Barbell
        —
        3x single dumbbell 💪
        - [x] 12 x 1x 30 each hand
        - [x] 10x 25lb both arms
        """

    /// Line number of the dangling `Barbell` header in `twoSessions`.
    static let danglingBarbellLine = 42
}
