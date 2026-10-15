import Testing

@testable import Lift

/// The rest countdown's value logic, driven tick by tick (TEST-3).
@Suite struct RestTimerTests {
    @Test func startsFull() {
        let timer = RestTimer(run: 1, seconds: 90)
        #expect(timer.remaining == 90)
        #expect(timer.total == 90)
        #expect(timer.elapsed == 0)
        #expect(timer.clockText == "1:30")
    }

    @Test func ticksDownOneSecondAtATime() {
        let timer = RestTimer(run: 1, seconds: 3).ticked()
        #expect(timer?.remaining == 2)
        #expect(timer?.elapsed == 1)
        #expect(timer?.run == 1)
    }

    @Test func endsAtZero() {
        let last = RestTimer(run: 1, seconds: 2).ticked()
        #expect(last?.remaining == 1)
        #expect(last?.ticked() == nil)
    }

    @Test func extendingAddsToTotalAndRemaining() {
        let timer = RestTimer(run: 2, seconds: 60).ticked()?.extended(by: 30)
        #expect(timer?.remaining == 89)
        #expect(timer?.total == 90)
        #expect(timer?.run == 2)
    }

    @Test func negativeValuesAreClamped() {
        let timer = RestTimer(run: 1, seconds: -5).extended(by: -10)
        #expect(timer.remaining == 0)
        #expect(timer.total == 0)
        #expect(timer.ticked() == nil)
    }

    @Test(arguments: [(0, "0:00"), (5, "0:05"), (59, "0:59"), (60, "1:00"), (125, "2:05"), (600, "10:00")])
    func clockText(seconds: Int, expected: String) {
        #expect(RestTimer(run: 1, seconds: seconds).clockText == expected)
    }
}
