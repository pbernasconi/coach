import Testing

@testable import KoboComponents

@MainActor
private final class StageLog {
    var stages: [SlowWait] = []
    var holdEnds = 0
}

@Suite struct StatusSlowWaitTests {
    @Test func stagesFollowTheThresholds() {
        #expect(SlowWait.stage(elapsed: .milliseconds(1_999)) == .none)
        #expect(SlowWait.stage(elapsed: .seconds(2)) == .slow)
        #expect(SlowWait.stage(elapsed: .milliseconds(14_999)) == .slow)
        #expect(SlowWait.stage(elapsed: .seconds(15)) == .verySlow)
    }

    @Test func theTimerReportsEachStageAtItsThreshold() async {
        let clock = TestClock()
        let log = StageLog()
        let task = Task { await SlowWait.timer(clock: clock) { log.stages.append($0) } }
        await clock.waitForSleepers(1)
        clock.advance(by: .milliseconds(1_999))
        await settle()
        #expect(log.stages.isEmpty)
        clock.advance(by: .milliseconds(1))
        await eventually { log.stages == [.slow] }
        await clock.waitForSleepers(1)
        clock.advance(by: .seconds(13))
        await task.value
        #expect(log.stages == [.slow, .verySlow])
    }

    @Test func aCancelledWaitReportsNoLaterStage() async {
        let clock = TestClock()
        let log = StageLog()
        let task = Task { await SlowWait.timer(clock: clock) { log.stages.append($0) } }
        await clock.waitForSleepers(1)
        task.cancel()
        await task.value
        clock.advance(by: .seconds(20))
        await settle()
        #expect(log.stages.isEmpty)
    }

    @Test func aFastAnswerKeepsTheSpinnerForTheHold() async {
        var hold = SpinnerHold().busyChanged(true).busyChanged(false)
        #expect(hold.isShown)
        let clock = TestClock()
        let log = StageLog()
        let task = Task { await SpinnerHold.timer(clock: clock) { log.holdEnds += 1 } }
        await clock.waitForSleepers(1)
        clock.advance(by: .milliseconds(299))
        await settle()
        #expect(log.holdEnds == 0)
        clock.advance(by: .milliseconds(1))
        await task.value
        #expect(log.holdEnds == 1)
        hold = hold.holdEnded()
        #expect(!hold.isShown)
    }

    @Test func aTapStartsTheHoldAndSlowWorkEndsTheSpinnerWithIt() {
        #expect(SpinnerHold().started().isShown)
        #expect(!SpinnerHold().started().holdEnded().isShown)
        let held = SpinnerHold().busyChanged(true).holdEnded()
        #expect(held.isShown)
        #expect(!held.busyChanged(false).isShown)
    }
}
