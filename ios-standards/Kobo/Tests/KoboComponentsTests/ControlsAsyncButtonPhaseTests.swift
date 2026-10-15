import Testing

@testable import KoboComponents

@Suite struct ControlsAsyncButtonPhaseTests {
    private func run(_ events: [AsyncButtonPhase.Event], confirmsSuccess: Bool = true) -> AsyncButtonPhase {
        events.reduce(AsyncButtonPhase.idle) { $0.reduce($1, confirmsSuccess: confirmsSuccess) }
    }

    @Test func aFastSuccessNeverShowsTheSpinner() {
        #expect(run([.tapped]) == .working)
        #expect(!run([.tapped]).showsSpinner)
        #expect(run([.tapped, .finished(succeeded: true)]) == .succeeded)
        #expect(run([.tapped, .finished(succeeded: true)], confirmsSuccess: false) == .idle)
    }

    @Test func aSlowActionShowsTheSpinnerAfterTheDelay() {
        let phase = run([.tapped, .delayElapsed])
        #expect(phase == .spinning(holdElapsed: false))
        #expect(phase.showsSpinner)
        #expect(phase.timer == .spinnerHold)
    }

    @Test func finishingInsideTheHoldWaitsForIt() {
        let settling = run([.tapped, .delayElapsed, .finished(succeeded: true)])
        #expect(settling == .settling(succeeded: true))
        #expect(settling.showsSpinner)
        #expect(settling.timer == .spinnerHold)
        #expect(settling.reduce(.holdElapsed, confirmsSuccess: true) == .succeeded)
    }

    @Test func finishingAfterTheHoldAppliesAtOnce() {
        #expect(run([.tapped, .delayElapsed, .holdElapsed, .finished(succeeded: false)]) == .idle)
        #expect(run([.tapped, .delayElapsed, .holdElapsed, .finished(succeeded: true)]) == .succeeded)
    }

    @Test func aFailureReturnsToIdleWithoutTheCheck() {
        #expect(run([.tapped, .finished(succeeded: false)]) == .idle)
        #expect(run([.tapped, .delayElapsed, .finished(succeeded: false), .holdElapsed]) == .idle)
    }

    @Test func tapsAreIgnoredWhileBusy() {
        #expect(run([.tapped, .tapped]) == .working)
        #expect(!AsyncButtonPhase.working.acceptsTaps)
        #expect(!AsyncButtonPhase.succeeded.acceptsTaps)
        #expect(AsyncButtonPhase.idle.acceptsTaps)
    }

    @Test func theCheckClearsAfterTheConfirmation() {
        #expect(AsyncButtonPhase.succeeded.timer == .confirmation)
        #expect(run([.tapped, .finished(succeeded: true), .confirmationElapsed]) == .idle)
    }

    @Test func staleTimersChangeNothing() {
        #expect(run([.delayElapsed, .holdElapsed, .confirmationElapsed]) == .idle)
        #expect(run([.tapped, .holdElapsed]) == .working)
    }
}
