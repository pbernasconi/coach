import Testing

@testable import KoboComponents

@MainActor
private final class GraceLog {
    var stages: [LoadingGrace] = []
}

@Suite struct FeedbackLoadingGraceTests {
    @Test func thePlaceholderShowsAfterTheGraceAndHoldsAfterThat() async {
        let clock = TestClock()
        let log = GraceLog()
        let task = Task { await LoadingGrace.timer(clock: clock) { log.stages.append($0) } }
        await clock.waitForSleepers(1)
        clock.advance(by: .milliseconds(399))
        await settle()
        #expect(log.stages.isEmpty)
        clock.advance(by: .milliseconds(1))
        await eventually { log.stages == [.shown] }
        await clock.waitForSleepers(1)
        clock.advance(by: .milliseconds(299))
        await settle()
        #expect(log.stages == [.shown])
        clock.advance(by: .milliseconds(1))
        await task.value
        #expect(log.stages == [.shown, .held])
    }

    @Test func aLoadThatEndsInTheGraceReportsNothing() async {
        let clock = TestClock()
        let log = GraceLog()
        let task = Task { await LoadingGrace.timer(clock: clock) { log.stages.append($0) } }
        await clock.waitForSleepers(1)
        task.cancel()
        await task.value
        clock.advance(by: .seconds(1))
        await settle()
        #expect(log.stages.isEmpty)
    }

    @Test(arguments: [
        (LoadingGrace.waiting, false, false),
        (.shown, true, true),
        (.held, true, false),
    ])
    func eachStageSaysWhatShows(stage: LoadingGrace, isVisible: Bool, holdsContent: Bool) {
        #expect(stage.isVisible == isVisible)
        #expect(stage.holdsContent == holdsContent)
    }

    @Test func theDurationsComeFromTheMotionTokens() {
        #expect(LoadingGrace.grace == .milliseconds(400))
        #expect(LoadingGrace.hold == .milliseconds(300))
    }
}
