import Foundation
import Testing

@testable import LiftCore

@Suite struct WeightTests {
    @Test(arguments: [
        (Weight.kg(100), WeightUnit.lb, 220.462),
        (Weight.lb(220.462_262), WeightUnit.kg, 100.0),
        (Weight.lb(45), WeightUnit.lb, 45.0),
        (Weight.kg(0), WeightUnit.lb, 0.0),
        (Weight.kg(-10), WeightUnit.lb, -22.046),
    ])
    func converts(weight: Weight, unit: WeightUnit, expected: Double) {
        let converted = weight.converted(to: unit)
        #expect(converted.unit == unit)
        #expect(abs(converted.value - expected) < 0.001)
    }

    @Test(arguments: [
        (Weight.lb(187), 5.0, FloatingPointRoundingRule.toNearestOrAwayFromZero, 185.0),
        (Weight.lb(187.5), 5.0, .toNearestOrAwayFromZero, 190.0),
        (Weight.lb(189), 5.0, .down, 185.0),
        (Weight.kg(61.3), 2.5, .toNearestOrAwayFromZero, 62.5),
        (Weight.kg(61.3), 1.25, .down, 61.25),
        (Weight.lb(42), 0, .toNearestOrAwayFromZero, 42.0),
        (Weight.lb(42), -5, .toNearestOrAwayFromZero, 42.0),
        (Weight.lb(0), 5, .toNearestOrAwayFromZero, 0.0),
    ])
    func roundsToStep(weight: Weight, step: Double, rule: FloatingPointRoundingRule, expected: Double) {
        #expect(weight.rounded(toStep: step, rule: rule) == Weight(expected, weight.unit))
    }

    @Test func roundsToStepInAnotherUnit() {
        // 2.5 kg ≈ 5.51 lb, so 100 lb rounds to 99.208 (18 steps)
        let rounded = Weight.lb(100).rounded(to: .kg(2.5))
        #expect(abs(rounded.value - 99.208) < 0.001)
        #expect(rounded.unit == .lb)
    }

    @Test func addsAcrossUnits() {
        let sum = Weight.lb(45).adding(.kg(20))
        #expect(abs(sum.value - 89.092) < 0.001)
        #expect(sum.unit == .lb)
    }

    @Test(arguments: [
        (Equipment.barbell, WeightUnit.lb, 5.0), (.barbell, .kg, 2.5),
        (.dumbbell, .lb, 5), (.dumbbell, .kg, 2),
        (.kettlebell, .lb, 9), (.kettlebell, .kg, 4),
        (.machine, .lb, 10), (.machine, .kg, 5),
        (.cable, .lb, 10), (.cable, .kg, 5),
        (.bodyweight, .lb, 5), (.other, .kg, 2.5),
    ])
    func defaultIncrements(equipment: Equipment, unit: WeightUnit, expected: Double) {
        #expect(equipment.defaultIncrement(in: unit) == Weight(expected, unit))
    }
}
