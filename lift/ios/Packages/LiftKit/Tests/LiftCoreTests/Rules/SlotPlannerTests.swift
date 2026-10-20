import Foundation
import Testing

@testable import LiftCore

/// Template targets upgraded by progression (TEST-4): made-up loads only.
@Suite struct SlotPlannerTests {
    private static let increment = Equipment.barbell.defaultIncrement(in: .kg)

    private static func slot(_ range: ClosedRange<Int>, weight: Weight? = nil, kind: SetKind = .working)
        -> TemplateExercise
    {
        TemplateExercise(
            id: TestCalendar.id(1),
            exerciseID: TestCalendar.id(2),
            displayName: "Made-up squat",
            sets: 3,
            repRange: range,
            weight: weight,
            kind: kind
        )
    }

    private static func sets(_ reps: [Int], _ weight: Weight?) -> [LoggedSet] {
        reps.map { TestCalendar.done($0, weight) }
    }

    @Test(arguments: [
        // No history: the slot's own target.
        (slot(5...5, weight: .kg(80)), [Int](), [Int](), SetTarget(reps: 5, weight: .kg(80))),
        (slot(8...12), [], [], SetTarget(repRange: 8...12)),
        // Every set hit the top: one increment over the last load, from the bottom of the range.
        (slot(5...5, weight: .kg(60)), [5, 5, 5], [], SetTarget(reps: 5, weight: .kg(82.5))),
        (slot(8...12), [12, 12, 12], [], SetTarget(reps: 8, repRange: 8...12, weight: .kg(82.5))),
        // Not yet: the last load again, one more rep.
        (slot(8...12), [10, 9, 9], [], SetTarget(reps: 10, repRange: 8...12, weight: .kg(80))),
        // Two sessions below the range: 90% of the load, rounded down to the increment.
        (slot(8...12), [6, 6, 6], [7, 6, 6], SetTarget(reps: 8, repRange: 8...12, weight: .kg(70))),
    ])
    func targetFollowsTheLastSession(slot: TemplateExercise, last: [Int], previous: [Int], expected: SetTarget) {
        let target = SlotPlanner.target(
            for: slot,
            last: Self.sets(last, .kg(80)),
            previous: Self.sets(previous, .kg(80)),
            increment: Self.increment,
            unit: .kg
        )
        #expect(target == expected)
    }

    @Test(arguments: [
        // 13 days: no break, the normal step up.
        (13, slot(5...5), SetTarget(reps: 5, weight: .kg(82.5))),
        // 14 days or more: 90% of 80 kg is 72 kg, on the 2.5 kg increment, from the bottom of the range.
        (14, slot(5...5), SetTarget(reps: 5, weight: .kg(72.5))),
        (25, slot(8...12), SetTarget(reps: 8, repRange: 8...12, weight: .kg(72.5))),
        // A heavier planned load does not win after a break.
        (25, slot(5...5, weight: .kg(100)), SetTarget(reps: 5, weight: .kg(72.5))),
    ])
    func aBreakStartsLighter(days: Int, slot: TemplateExercise, expected: SetTarget) {
        let target = SlotPlanner.target(
            for: slot,
            last: Self.sets([5, 5, 5], .kg(80)),
            increment: Self.increment,
            unit: .kg,
            daysSinceLast: days
        )
        #expect(target == expected)
    }

    @Test func aBreakWithoutLoadKeepsBodyweight() {
        let target = SlotPlanner.target(
            for: Self.slot(8...10),
            last: Self.sets([10, 10, 8], nil),
            increment: Self.increment,
            unit: .kg,
            daysSinceLast: 30
        )
        #expect(target == SetTarget(reps: 8, repRange: 8...10))
    }

    @Test(arguments: [
        // The nearest step to 90%; the same load when the step is too coarse for a lighter one.
        (Weight.lb(255), Weight.lb(5), Weight.lb(230)),
        (Weight.lb(27.5), Weight.lb(5), Weight.lb(25)),
        (Weight.lb(45), Weight.lb(5), Weight.lb(40)),
        (Weight.lb(15), Weight.lb(5), Weight.lb(15)),
        (Weight.lb(25), Weight.lb(5), Weight.lb(25)),
    ])
    func afterBreakRounding(weight: Weight, increment: Weight, expected: Weight) {
        #expect(SlotPlanner.afterBreak(weight, increment) == expected)
    }

    @Test func aHeavierPlannedLoadWinsOverHistory() {
        let target = SlotPlanner.target(
            for: Self.slot(5...5, weight: .kg(100)),
            last: Self.sets([5, 5, 5], .kg(80)),
            increment: Self.increment,
            unit: .kg
        )
        #expect(target == SetTarget(reps: 5, weight: .kg(100)))
    }

    @Test func historyInTheOtherUnitIsConvertedAndRounded() {
        let target = SlotPlanner.target(
            for: Self.slot(5...5),
            last: Self.sets([5, 5, 5], .lb(225)),
            increment: Self.increment,
            unit: .kg
        )
        // 225 lb plus a 2.5 kg increment is 104.6 kg, rounded to the increment.
        #expect(target == SetTarget(reps: 5, weight: .kg(105)))
    }

    @Test func warmUpSlotsKeepTheirTarget() {
        let target = SlotPlanner.target(
            for: Self.slot(10...10, weight: .kg(20), kind: .warmUp),
            last: Self.sets([10, 10], .kg(40)),
            increment: Self.increment,
            unit: .kg
        )
        #expect(target == SetTarget(reps: 10, weight: .kg(20)))
    }

    @Test func slotRepeatsTheLastSessionsShape() {
        let exercise = ExerciseLibrary.seed[0]
        let last = [
            LoggedSet(id: TestCalendar.id(3), kind: .warmUp, target: SetTarget(reps: 5)),
            LoggedSet(id: TestCalendar.id(4), target: SetTarget(reps: 5, weight: .kg(90))),
            LoggedSet(id: TestCalendar.id(5), target: SetTarget(reps: 5, weight: .kg(90))),
        ]
        let slot = SlotPlanner.slot(id: TestCalendar.id(9), exercise: exercise, last: last)
        #expect(slot.sets == 2)
        #expect(slot.repRange == 5...5)
        #expect(slot.exerciseID == exercise.id)
        #expect(slot.displayName == exercise.name)
        #expect(slot.weight == nil)
    }

    @Test func slotWithoutHistoryUsesTheDefaults() {
        let slot = SlotPlanner.slot(id: TestCalendar.id(9), exercise: ExerciseLibrary.seed[0], last: [])
        #expect(slot.sets == 3)
        #expect(slot.repRange == 8...12)
        #expect(slot.restSeconds == 120)
        #expect(slot.target == SetTarget(repRange: 8...12))
    }
}
