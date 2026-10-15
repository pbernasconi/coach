import Testing

@testable import CraftComponents

@Suite struct ControlsStepperMathTests {
    @Test(arguments: [
        (21.0, 2.5, StepperMath.Direction.up, 22.5),
        (21.0, 2.5, StepperMath.Direction.down, 20.0),
        (20.0, 2.5, StepperMath.Direction.up, 22.5),
        (20.0, 2.5, StepperMath.Direction.down, 17.5),
        (100.0, 5.0, StepperMath.Direction.up, 105.0),
        (0.0, 1.0, StepperMath.Direction.down, 0.0),
        (500.0, 2.5, StepperMath.Direction.up, 500.0),
        (499.0, 2.5, StepperMath.Direction.up, 500.0),
        (0.3, 0.1, StepperMath.Direction.up, 0.4),
        (0.3, 0.1, StepperMath.Direction.down, 0.2),
    ])
    func stepsSnapToTheGridAndClamp(value: Double, step: Double, direction: StepperMath.Direction, expected: Double) {
        #expect(StepperMath.stepped(value, by: step, direction, in: 0...500) == expected)
    }

    @Test func gridIsAnchoredAtTheLowerBound() {
        #expect(StepperMath.stepped(45, by: 5, StepperMath.Direction.up, in: 45...200) == 50)
        #expect(StepperMath.stepped(46, by: 5, StepperMath.Direction.down, in: 45...200) == 45)
        #expect(StepperMath.stepped(46, by: 5, StepperMath.Direction.up, in: 45...200) == 50)
    }

    @Test func outOfRangeValuesClampFirst() {
        #expect(StepperMath.clamped(-3, to: 0...10) == 0)
        #expect(StepperMath.clamped(12, to: 0...10) == 10)
        #expect(StepperMath.clamped(4.5, to: 0...10) == 4.5)
        #expect(StepperMath.stepped(-3, by: 1, StepperMath.Direction.down, in: 0...10) == 0)
    }

    @Test func nonPositiveStepDoesNotMove() {
        #expect(StepperMath.stepped(4, by: 0, StepperMath.Direction.up, in: 0...10) == 4)
        #expect(StepperMath.stepped(4, by: -1, StepperMath.Direction.down, in: 0...10) == 4)
    }

    @Test func canStepIsFalseOnlyAtTheBounds() {
        #expect(!StepperMath.canStep(0, by: 2.5, StepperMath.Direction.down, in: 0...100))
        #expect(StepperMath.canStep(0, by: 2.5, StepperMath.Direction.up, in: 0...100))
        #expect(!StepperMath.canStep(100, by: 2.5, StepperMath.Direction.up, in: 0...100))
        #expect(StepperMath.canStep(100, by: 2.5, StepperMath.Direction.down, in: 0...100))
    }

    @Test func repeatedDecimalStepsStayClean() {
        var value = 0.0
        for _ in 0..<10 { value = StepperMath.stepped(value, by: 0.1, StepperMath.Direction.up, in: 0...5) }
        #expect(value == 1.0)
    }

    @Test(arguments: [
        (100.0, [90.0, 95.0, 100.0, 105.0, 110.0]),
        (0.0, [0.0, 5.0, 10.0, 15.0, 20.0]),
        (500.0, [480.0, 485.0, 490.0, 495.0, 500.0]),
        (101.0, [90.0, 95.0, 100.0, 105.0, 110.0]),
        (103.0, [95.0, 100.0, 105.0, 110.0, 115.0]),
    ])
    func nearbyValuesCentreAndShiftInsideTheRange(value: Double, expected: [Double]) {
        #expect(StepperMath.nearby(value, step: 5, count: 5, in: 0...500) == expected)
    }

    @Test func nearbyValuesWithHalfSteps() {
        #expect(StepperMath.nearby(60, step: 2.5, count: 5, in: 20...200) == [55, 57.5, 60, 62.5, 65])
    }

    @Test func nearbyValuesInASmallRangeReturnEveryGridValue() {
        #expect(StepperMath.nearby(5, step: 5, count: 5, in: 0...10) == [0, 5, 10])
        #expect(StepperMath.nearby(5, step: 0, count: 5, in: 0...10).isEmpty)
        #expect(StepperMath.nearby(5, step: 1, count: 0, in: 0...10).isEmpty)
    }

    #if canImport(SwiftUI)
        @Test func publicNearbyValuesMatchesTheMaths() {
            #expect(StepperField.nearbyValues(around: 8, step: 1, in: 1...50) == [6, 7, 8, 9, 10])
        }
    #endif
}
