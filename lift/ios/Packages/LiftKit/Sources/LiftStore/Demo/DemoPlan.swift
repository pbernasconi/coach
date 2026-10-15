import Foundation
import LiftCore

/// The fabricated training block behind demo mode and screenshots (TEST-8). Every number is made up.
enum DemoPlan {
    /// One lift in a demo day: a library seed number, sets × reps, and a starting load that rises each week.
    struct Lift {
        let seedNumber: UInt8
        let sets: Int
        let reps: Int
        let startKg: Double
        let weeklyStepKg: Double
    }

    struct Day {
        let title: String
        let lifts: [Lift]
    }

    /// One session in the block: which day it is, how far from today, which week of progression, and for a past one
    /// the minute of the day it started (made up).
    struct Slot {
        let dayOffset: Int
        let day: Day
        let week: Int
        var startMinute = 0
    }

    /// Made-up pacing for a logged session: the warm-up before the first set, the time from one set to the next of
    /// the same lift (about 45 s of work and 2 min 45 s of rest), the time to set up the next lift, and the cool-down
    /// after the last set. A demo session lasts about 45 minutes.
    enum Pace {
        static let warmUp: TimeInterval = 9 * 60
        static let betweenSets: TimeInterval = 3.5 * 60
        static let betweenLifts: TimeInterval = 6 * 60
        static let coolDown: TimeInterval = 4 * 60
    }

    static let lower = Day(
        title: "Lower A",
        lifts: [
            Lift(seedNumber: 1, sets: 3, reps: 5, startKg: 80, weeklyStepKg: 2.5),
            Lift(seedNumber: 3, sets: 3, reps: 8, startKg: 60, weeklyStepKg: 2.5),
            Lift(seedNumber: 17, sets: 2, reps: 10, startKg: 14, weeklyStepKg: 1),
        ]
    )

    static let upper = Day(
        title: "Upper A",
        lifts: [
            Lift(seedNumber: 5, sets: 3, reps: 5, startKg: 60, weeklyStepKg: 2.5),
            Lift(seedNumber: 10, sets: 3, reps: 8, startKg: 50, weeklyStepKg: 2.5),
            Lift(seedNumber: 23, sets: 2, reps: 12, startKg: 6, weeklyStepKg: 0),
        ]
    )

    /// The days the demo templates are made from.
    static let days = [upper, lower]

    /// The progression week of each of the nine weeks before the last three, oldest first: loads climb, with a few
    /// repeated weeks, so the progress charts and the weekly volume have three months of made-up history.
    static let earlierWeeks = [-6, -5, -5, -4, -3, -3, -2, -1, -1]

    /// Those nine weeks: the same two sessions a week, at the same made-up times as the last three.
    static let earlierSlots: [Slot] = earlierWeeks.enumerated().flatMap { index, week in
        let back = 7 * (earlierWeeks.count - index)
        return [
            Slot(dayOffset: -20 - back, day: lower, week: week, startMinute: 7 * 60 + 5),
            Slot(dayOffset: -17 - back, day: upper, week: week, startMinute: 18 * 60 + 20),
        ]
    }

    /// Twelve past weeks of two sessions, then two upcoming sessions planned from the templates.
    static let slots: [Slot] =
        earlierSlots + [
            Slot(dayOffset: -20, day: lower, week: 0, startMinute: 7 * 60 + 5),
            Slot(dayOffset: -17, day: upper, week: 0, startMinute: 18 * 60 + 20),
            Slot(dayOffset: -13, day: lower, week: 1, startMinute: 7 * 60 + 12),
            Slot(dayOffset: -10, day: upper, week: 1, startMinute: 18 * 60 + 35),
            Slot(dayOffset: -6, day: lower, week: 2, startMinute: 6 * 60 + 58),
            Slot(dayOffset: -3, day: upper, week: 2, startMinute: 18 * 60 + 10),
            Slot(dayOffset: 1, day: lower, week: 3),
            Slot(dayOffset: 4, day: upper, week: 3),
        ]
}
