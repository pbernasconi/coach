import Testing

@testable import KoboComponents

@Suite struct StatusInlineProgressMathTests {
    @Test func fractionsClampToTheTrack() {
        #expect(InlineProgressMath.fraction(3, total: 4) == 0.75)
        #expect(InlineProgressMath.fraction(-1, total: 4) == 0)
        #expect(InlineProgressMath.fraction(9, total: 4) == 1)
        #expect(InlineProgressMath.fraction(1, total: 0) == 0)
        #expect(InlineProgressMath.fraction(.nan, total: 1) == 0)
        #expect(InlineProgressMath.fraction(1, total: .infinity) == 0)
    }

    @Test func percentagesRoundAndClamp() {
        #expect(InlineProgressMath.percent(0.404) == 40)
        #expect(InlineProgressMath.percent(0.405) == 41)
        #expect(InlineProgressMath.percent(1.2) == 100)
        #expect(InlineProgressMath.percent(-0.2) == 0)
    }

    @Test func theBandSweepsFromOffTheLeadingEdgeToOffTheTrailingEdge() {
        let period = InlineProgressMath.period
        #expect(InlineProgressMath.bandOffset(at: 0) == -InlineProgressMath.bandWidth)
        #expect(abs(InlineProgressMath.bandOffset(at: period * 0.999_999) - 1) < 0.001)
        let middle = InlineProgressMath.bandOffset(at: period * 0.5)
        #expect(abs(InlineProgressMath.bandOffset(at: period * 2.5) - middle) < 0.000_001)
        #expect(abs(InlineProgressMath.bandOffset(at: -period * 0.5) - middle) < 0.000_001)
    }
}
