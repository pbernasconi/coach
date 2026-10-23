import Foundation
import Testing

@testable import KoboComponents

@Suite struct BackdropSheetSpringTests {
    @Test func startsWhereItIsAndEndsOnTheDetent() {
        let spring = BackdropSheetSpring(from: 100, to: 400, velocity: 0, response: 0.3)
        #expect(spring.value(at: 0) == 100)
        #expect(abs(spring.value(at: 2) - 400) < 0.001)
    }

    @Test func neverOvershoots() {
        let spring = BackdropSheetSpring(from: 0, to: 400, velocity: 3000, response: 0.3)
        let values = stride(from: 0.0, through: 1.5, by: 0.005).map(spring.value(at:))
        #expect(values.allSatisfy { $0 <= 400.5 })
    }

    @Test func keepsTheReleaseSpeed() {
        let spring = BackdropSheetSpring(from: 0, to: 400, velocity: 1500, response: 0.3)
        #expect(abs(spring.speed(at: 0) - 1500) < 0.001)
    }

    @Test func settlesQuickly() {
        let spring = BackdropSheetSpring(from: 0, to: 400, velocity: 0, response: 0.3)
        let settled = stride(from: 0.0, through: 2, by: 1.0 / 120).first(where: spring.isSettled(at:))
        #expect((settled ?? 2) < 0.5)
        #expect(!spring.isSettled(at: 0.05))
    }
}
