import Foundation
import Testing

@testable import LiftCore

@Suite struct WarmUpPlannerTests {
    private static func ramp(_ steps: [(Int, Double)], _ unit: WeightUnit) -> [SetTarget] {
        steps.map { SetTarget(reps: $0.0, weight: Weight($0.1, unit)) }
    }

    @Test func rampsAPoundBarbellLift() {
        let plan = WarmUpPlanner.plan(working: .lb(225), equipment: .barbell)
        #expect(plan == Self.ramp([(10, 45), (5, 110), (3, 155), (1, 190)], .lb))
    }

    @Test func rampsAtTheThreshold() {
        #expect(
            WarmUpPlanner.plan(working: .lb(135), equipment: .barbell)
                == Self.ramp([(10, 45), (5, 65), (3, 95), (1, 115)], .lb)
        )
        #expect(
            WarmUpPlanner.plan(working: .kg(60), equipment: .barbell)
                == Self.ramp([(10, 20), (5, 30), (3, 42.5), (1, 50)], .kg)
        )
    }

    @Test(arguments: [
        (Weight.lb(134), Equipment.barbell),
        (.kg(59), .barbell),
        (.lb(0), .barbell),
        (.lb(-200), .barbell),
        (.lb(225), .dumbbell),
        (.kg(100), .machine),
        (.lb(300), .kettlebell),
    ])
    func skipsLightOrNonBarbellLifts(working: Weight, equipment: Equipment) {
        #expect(WarmUpPlanner.plan(working: working, equipment: equipment).isEmpty)
    }

    @Test func dropsDuplicatesAndAnythingAtTheWorkingWeight() {
        let onlyFortyFives = PlateSet(unit: .lb, bar: 45, plates: [45])
        #expect(
            WarmUpPlanner.plan(working: .lb(150), equipment: .barbell, plates: onlyFortyFives)
                == Self.ramp([(10, 45), (3, 135)], .lb)
        )
        #expect(
            WarmUpPlanner.plan(working: .lb(135), equipment: .barbell, plates: onlyFortyFives)
                == Self.ramp([(10, 45)], .lb)
        )
    }

    @Test func roundsEachStepToWhatThePlatesCanMake() {
        let noSmallPlates = PlateSet(unit: .kg, bar: 20, stock: [.init(size: 20, pairs: 4), .init(size: 5, pairs: 1)])
        #expect(
            WarmUpPlanner.plan(working: .kg(100), equipment: .barbell, plates: noSmallPlates)
                == Self.ramp([(10, 20), (5, 60), (3, 70)], .kg)  // 85% rounds to 70 again
        )
    }

    @Test func startsFromTheGymsBar() {
        let light = PlateSet(unit: .kg, bar: 15, stock: [.init(size: 10, pairs: 2), .init(size: 2.5, pairs: 2)])
        #expect(
            WarmUpPlanner.plan(working: .kg(60), equipment: .barbell, plates: light)
                == Self.ramp([(10, 15), (5, 25), (3, 40), (1, 55)], .kg)
        )
    }

    @Test func pairLimitsCapTheRamp() {
        let onePair = PlateSet(unit: .lb, bar: 45, stock: [.init(size: 45, pairs: 1), .init(size: 25, pairs: 1)])
        #expect(
            WarmUpPlanner.plan(working: .lb(225), equipment: .barbell, plates: onePair)
                == Self.ramp([(10, 45), (5, 95), (3, 135), (1, 185)], .lb)
        )
    }
}
