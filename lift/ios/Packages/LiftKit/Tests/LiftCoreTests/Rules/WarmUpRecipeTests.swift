import Foundation
import Testing

@testable import LiftCore

@Suite struct WarmUpRecipeTests {
    private static func barbell(_ working: Weight?) -> WarmUpRecipe.Exercise {
        WarmUpRecipe.Exercise(equipment: .barbell, loadMode: .total, working: working)
    }

    private static func dumbbell(_ working: Weight?) -> WarmUpRecipe.Exercise {
        WarmUpRecipe.Exercise(equipment: .dumbbell, loadMode: .perHand, working: working)
    }

    @Test func aHeavyDayRampsTheFirstBarbellLiftAndGivesLaterOnesOneSet() {
        let plan = WarmUpRecipe.plan([Self.barbell(.lb(240)), Self.dumbbell(.lb(70)), Self.barbell(.lb(185))])
        #expect(plan.isHeavy)
        #expect(plan.sets[0] == WarmUpPlanner.plan(working: .lb(240), equipment: .barbell))
        #expect(plan.sets[1].isEmpty)
        #expect(plan.sets[2] == [SetTarget(reps: 5, weight: .lb(110))])
        #expect(plan.checklist == WarmUpChecklist(items: WarmUpRecipe.heavyChecklist))
    }

    @Test func aLightDayGetsOneFeelerOnTheFirstLoadedExercise() {
        let pushUps = WarmUpRecipe.Exercise(equipment: .bodyweight, loadMode: .bodyweight(added: nil), working: nil)
        let plan = WarmUpRecipe.plan([pushUps, Self.dumbbell(.lb(25)), Self.dumbbell(.lb(40))])
        #expect(!plan.isHeavy)
        #expect(plan.sets == [[], [SetTarget(reps: 8, weight: .lb(15))], []])
        #expect(plan.checklist == WarmUpChecklist(items: WarmUpRecipe.lightChecklist))
    }

    @Test func aLightBarbellLiftIsNotAHeavyDay() {
        let plan = WarmUpRecipe.plan([Self.barbell(.lb(95))])
        #expect(!plan.isHeavy)
        #expect(plan.sets == [[SetTarget(reps: 8, weight: .lb(50))]])
    }

    @Test func noLoadsMeansOnlyTheChecklist() {
        let plan = WarmUpRecipe.plan([Self.dumbbell(nil)])
        #expect(plan.sets == [[]])
        #expect(plan.checklist.items.count == WarmUpRecipe.lightChecklist.count)
    }

    @Test func theChecklistRoundTripsThroughTheNote() {
        let checklist = WarmUpChecklist(items: ["Easy cardio · 5 min", "Bird dog · 5 / side"]).toggling(0)
        #expect(checklist.note == "[x] Easy cardio · 5 min\n[ ] Bird dog · 5 / side")
        #expect(WarmUpChecklist(note: checklist.note) == checklist)
        #expect(checklist.doneCount == 1)
        #expect(!checklist.isComplete)
        #expect(checklist.allDone().isComplete)
    }

    @Test func aPlainNoteIsNoChecklistAndUnboxedLinesCountAsDone() {
        #expect(WarmUpChecklist(note: "5 min rower") == nil)
        #expect(WarmUpChecklist(note: nil) == nil)
        let mixed = WarmUpChecklist(note: "5 min rower\n[ ] Band pull-aparts · 15")
        #expect(mixed?.items.map(\.isDone) == [true, false])
    }
}
