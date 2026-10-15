import CraftTokens
import Testing

@testable import CraftComponents

@Suite struct FeedbackToastCenterTests {
    final class Recorder {
        var calls = 0
    }

    @Test func showMakesTheToastCurrent() {
        let center = ToastCenter(clock: TestClock())
        let toast = Toast("Workout saved", tone: .success)
        center.show(toast)
        #expect(center.current == toast)
    }

    @Test func dismissesItselfAfterItsDuration() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        let toast = Toast("Workout saved", duration: .seconds(4))

        center.show(toast)
        await clock.waitForSleepers(1)
        clock.advance(by: .seconds(3))
        await settle()
        #expect(center.current == toast)

        clock.advance(by: .seconds(1))
        await eventually { center.current == nil }
        #expect(center.current == nil)
    }

    @Test func aNewToastReplacesTheCurrentOneAndRestartsTheTimer() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        let first = Toast("First", duration: .seconds(4))
        let second = Toast("Second", duration: .seconds(10))

        center.show(first)
        await clock.waitForSleepers(1)
        center.show(second)
        #expect(center.current == second)
        #expect(clock.sleeperCount == 0)  // The first timer was cancelled at once.

        await clock.waitForSleepers(1)
        clock.advance(by: .seconds(4))
        await settle()
        #expect(center.current == second)

        clock.advance(by: .seconds(6))
        await eventually { center.current == nil }
        #expect(center.current == nil)
    }

    @Test func dismissClearsTheToastAndCancelsItsTimer() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        let toast = Toast("Saved")

        center.show(toast)
        await clock.waitForSleepers(1)
        center.dismiss(toast.id)

        #expect(center.current == nil)
        #expect(clock.sleeperCount == 0)
    }

    @Test func aStaleDismissLeavesTheNewerToast() {
        let center = ToastCenter(clock: TestClock())
        let first = Toast("First")
        let second = Toast("Second")

        center.show(first)
        center.show(second)
        center.dismiss(first.id)

        #expect(center.current == second)
    }

    @Test func dismissCurrentClearsWhateverIsShown() {
        let center = ToastCenter(clock: TestClock())
        center.show(Toast("Saved"))
        center.dismissCurrent()
        #expect(center.current == nil)
    }

    @Test func performingTheActionRunsItOnceAndDismisses() {
        let center = ToastCenter(clock: TestClock())
        let recorder = Recorder()
        let toast = Toast("Set deleted", action: .init("Undo") { recorder.calls += 1 })

        center.show(toast)
        center.performAction(of: toast)

        #expect(recorder.calls == 1)
        #expect(center.current == nil)
    }

    @Test func aToastWithAnActionStaysLonger() {
        let plain = Toast("Saved")
        let undoable = Toast("Set deleted", action: .init("Undo") {})

        #expect(undoable.duration > plain.duration)
        #expect(plain.duration == Toast.defaultDuration(hasAction: false))
        #expect(undoable.duration == Toast.defaultDuration(hasAction: true))
        #expect(Toast("Custom", action: .init("Undo") {}, duration: .seconds(2)).duration == .seconds(2))
    }

    @Test func announcementNamesTheAction() {
        #expect(Toast("Saved").announcement == "Saved")
        #expect(Toast("Set deleted", action: .init("Undo") {}).announcement == "Set deleted. Undo available")
    }

    @Test func symbolFallsBackToTheTone() {
        #expect(Toast("Saved", tone: .success).resolvedSymbol == Tone.success.feedbackSymbol)
        #expect(Toast("Saved", tone: .success, symbol: "star").resolvedSymbol == "star")
    }

    @Test func toastsAreEqualOnlyByIdentity() {
        let first = Toast("Same")
        let second = Toast("Same")
        #expect(first != second)
    }
}
