import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

@Suite struct FeedbackToastCenterTests {
    final class Recorder {
        var calls = 0
    }

    @Test func showMakesTheToastCurrent() {
        let center = ToastCenter(clock: TestClock())
        let toast = Toast(verbatim: "Task saved", tone: .success)
        center.show(toast)
        #expect(center.current == toast)
    }

    @Test func dismissesItselfAfterItsDuration() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        let toast = Toast(verbatim: "Task saved", duration: .seconds(4))

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
        let first = Toast(verbatim: "First", duration: .seconds(4))
        let second = Toast(verbatim: "Second", duration: .seconds(10))

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
        let toast = Toast(verbatim: "Saved")

        center.show(toast)
        await clock.waitForSleepers(1)
        center.dismiss(toast.id)

        #expect(center.current == nil)
        #expect(clock.sleeperCount == 0)
    }

    @Test func aStaleDismissLeavesTheNewerToast() {
        let center = ToastCenter(clock: TestClock())
        let first = Toast(verbatim: "First")
        let second = Toast(verbatim: "Second")

        center.show(first)
        center.show(second)
        center.dismiss(first.id)

        #expect(center.current == second)
    }

    @Test func dismissCurrentClearsWhateverIsShown() {
        let center = ToastCenter(clock: TestClock())
        center.show(Toast(verbatim: "Saved"))
        center.dismissCurrent()
        #expect(center.current == nil)
    }

    @Test func performingTheActionRunsItOnceAndDismisses() {
        let center = ToastCenter(clock: TestClock())
        let recorder = Recorder()
        let toast = Toast(verbatim: "Set deleted", action: .init(verbatim: "Undo") { recorder.calls += 1 })

        center.show(toast)
        center.performAction(of: toast)

        #expect(recorder.calls == 1)
        #expect(center.current == nil)
    }

    @Test func aToastWithAnActionStaysLonger() {
        let plain = Toast(verbatim: "Saved")
        let undoable = Toast(verbatim: "Set deleted", action: .init(verbatim: "Undo") {})

        #expect(undoable.duration > plain.duration)
        #expect(plain.duration == Toast.defaultDuration(hasAction: false))
        #expect(undoable.duration == Toast.defaultDuration(hasAction: true))
        #expect(
            Toast(verbatim: "Custom", action: .init(verbatim: "Undo") {}, duration: .seconds(2)).duration == .seconds(2)
        )
    }

    @Test func announcementNamesTheAction() {
        #expect(Toast(verbatim: "Saved").announcement == "Saved")
        #expect(
            Toast(verbatim: "Set deleted", action: .init(verbatim: "Undo") {}).announcement
                == "Set deleted. Undo available"
        )
    }

    @Test func symbolFallsBackToTheTone() {
        #expect(Toast(verbatim: "Saved", tone: .success).resolvedSymbol == Tone.success.feedbackSymbol)
        #expect(Toast(verbatim: "Saved", tone: .success, symbol: "star").resolvedSymbol == "star")
    }

    @Test func toastsAreEqualOnlyByIdentity() {
        let first = Toast(verbatim: "Same")
        let second = Toast(verbatim: "Same")
        #expect(first != second)
    }

    #if canImport(SwiftUI)  // the LocalizedStringResource initialisers live in a SwiftUI file
        @Test func localizedCopyResolvesWithoutATranslation() {
            let toast = Toast("Task deleted", action: .init("Undo") {})
            #expect(toast.message == "Task deleted")
            #expect(toast.action?.label == "Undo")
        }

        @Test func keyValueItemIdDefaultsToTheCatalogKey() {
            #expect(KeyValueItem("Distance", value: "1,240 km").id == "Distance")
            #expect(KeyValueItem(verbatim: "Grip", value: "Hook").id == "Grip")
        }
    #endif
}
