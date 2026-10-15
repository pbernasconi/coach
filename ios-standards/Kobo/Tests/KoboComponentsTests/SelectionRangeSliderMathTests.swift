import Testing

@testable import KoboComponents

@Suite struct SelectionRangeSliderMathTests {
    private let bounds = 0.0...200.0

    @Test(arguments: [
        (21.0, 2.5, 20.0),
        (21.3, 2.5, 22.5),
        (-5.0, 2.5, 0.0),
        (250.0, 2.5, 200.0),
        (0.1 + 0.2, 0.1, 0.3),
        (33.0, 0.0, 33.0),
    ])
    func snapsToTheGridInsideTheBounds(value: Double, step: Double, expected: Double) {
        #expect(RangeSliderMath.snapped(value, step: step, in: bounds) == expected)
    }

    @Test func anOffGridUpperBoundStaysReachable() {
        let bounds = 0.0...10.0
        #expect(RangeSliderMath.snapped(9.9, step: 3, in: bounds) == 10)
        #expect(RangeSliderMath.snapped(9.2, step: 3, in: bounds) == 9)
        #expect(RangeSliderMath.snapped(10, step: 3, in: bounds) == 10)
    }

    @Test func thumbsNeverCross() {
        let range = 40.0...120.0
        #expect(RangeSliderMath.moved(.lower, to: 150, range: range, bounds: bounds, step: 5) == 120...120)
        #expect(RangeSliderMath.moved(.upper, to: 10, range: range, bounds: bounds, step: 5) == 40...40)
        #expect(RangeSliderMath.moved(.lower, to: 61, range: range, bounds: bounds, step: 5) == 60...120)
        #expect(RangeSliderMath.moved(.upper, to: 999, range: range, bounds: bounds, step: 5) == 40...200)
    }

    @Test func aCallersRangeIsNormalised() {
        #expect(RangeSliderMath.normalized(-10...41, bounds: bounds, step: 5) == 0...40)
        #expect(RangeSliderMath.normalized(300...400, bounds: bounds, step: 5) == 200...200)
    }

    @Test func adjustableStepsMoveOneStepAndStopAtTheOtherThumb() {
        let range = 40.0...45.0
        #expect(RangeSliderMath.stepped(.upper, up: true, range: range, bounds: bounds, step: 5) == 40...50)
        #expect(RangeSliderMath.stepped(.lower, up: true, range: range, bounds: bounds, step: 5) == 45...45)
        #expect(RangeSliderMath.stepped(.lower, up: false, range: 0...45, bounds: bounds, step: 5) == 0...45)
    }

    @Test func stackedThumbsFollowTheDragDirection() {
        #expect(RangeSliderMath.thumb(grabbed: .upper, toward: 150, range: 200...200) == .lower)
        #expect(RangeSliderMath.thumb(grabbed: .lower, toward: 50, range: 0...0) == .upper)
        #expect(RangeSliderMath.thumb(grabbed: .lower, toward: 150, range: 40...120) == .lower)
    }

    @Test func fractionsMapBothWaysAndClamp() {
        #expect(RangeSliderMath.fraction(of: 50, in: bounds) == 0.25)
        #expect(RangeSliderMath.fraction(of: 300, in: bounds) == 1)
        #expect(RangeSliderMath.fraction(of: 5, in: 5...5) == 0)
        #expect(RangeSliderMath.value(atFraction: 0.5, in: bounds) == 100)
        #expect(RangeSliderMath.value(atFraction: -1, in: bounds) == 0)
    }
}
