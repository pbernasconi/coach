import Foundation
import Testing

@testable import KoboComponents

@Suite struct BackdropSheetMathTests {
    /// A 912-point screen with a 122-point bar: collapsed top 808, medium top 383, expanded top 122.
    private let math = BackdropSheetMath(height: 912, expandedTop: 122, mediumFraction: 0.42, peek: 104)

    @Test func detentsSitWhereTheyShould() {
        #expect(math.top(.collapsed) == 808)
        #expect(abs(math.top(.medium) - 383.04) < 0.001)
        #expect(math.top(.expanded) == 122)
        #expect(math.offset(.collapsed) == 0)
        #expect(math.offset(.expanded) == 686)
        #expect(math.sheetTop(offset: 686) == 122)
    }

    @Test func mediumNeverGoesAboveExpandedOrBelowCollapsed() {
        let short = BackdropSheetMath(height: 300, expandedTop: 200, mediumFraction: 0.1, peek: 50)
        #expect(short.top(.medium) == 200)
        let tall = BackdropSheetMath(height: 300, expandedTop: 0, mediumFraction: 0.99, peek: 100)
        #expect(tall.top(.medium) == 200)
    }

    @Test(arguments: [
        // (from, projected, expected): a slow release goes to the nearest detent.
        (10.0, 12.0, 0.0),
        (300.0, 310.0, 424.96),
        (600.0, 610.0, 686.0),
        // A flick moves at least one detent the way it went.
        (430.0, 470.0, 686.0),
        (430.0, 390.0, 424.96),
        (400.0, 340.0, 0.0),
        (20.0, 60.0, 424.96),
        // A fling up from inside the sheet's range stops at the top: it never coasts into the content.
        (424.96, 2000.0, 686.0),
    ])
    func dragsComeToRestOnADetent(from: Double, projected: Double, expected: Double) {
        #expect(abs(math.target(from: from, projected: projected) - expected) < 0.01)
    }

    @Test func aSlowFlickMovesOneStepAndAFastOneMaySkip() {
        #expect(abs(math.target(from: 20, projected: 700, speed: 1200) - 424.96) < 0.01)
        #expect(math.target(from: 20, projected: 700, speed: 2600) == 686)
        #expect(abs(math.target(from: 660, projected: -300, speed: -1500) - 424.96) < 0.01)
        #expect(math.target(from: 660, projected: -300, speed: -3000) == 0)
    }

    @Test func contentCoastsButStopsAtItsTop() {
        #expect(math.target(from: 900, projected: 1400) == 1400)
        #expect(math.target(from: 900, projected: 300) == 686)
    }

    @Test func restingDetentIsTheNearest() {
        #expect(math.detent(at: 0) == .collapsed)
        #expect(math.detent(at: 420) == .medium)
        #expect(math.detent(at: 686) == .expanded)
        #expect(math.detent(at: 1200) == .expanded)
    }

    @Test func progressRunsFromMedium() {
        #expect(math.expansion(offset: math.offset(.medium)) == 0)
        #expect(math.expansion(offset: math.offset(.expanded)) == 1)
        #expect(math.collapse(offset: 0) == 1)
        #expect(math.collapse(offset: 686) == 0)
        #expect(BackdropSheetMath.unit(5, from: 0, to: 10) == 0.5)
        #expect(BackdropSheetMath.unit(-5, from: 0, to: 10) == 0)
        #expect(BackdropSheetMath.unit(3, from: 3, to: 3) == 1)
    }
}
