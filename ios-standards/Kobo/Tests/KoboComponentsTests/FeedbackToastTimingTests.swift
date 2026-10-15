import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

/// Ported from Trellis's `ToastTimerTests`, `ToastMetricsTests` and `LiveToastCenter` rules: a finger on the toast
/// stops its timer, VoiceOver keeps an action reachable, and the toast hugs its message up to a cap.
@Suite struct FeedbackToastTimingTests {
    // MARK: ToastTimer

    @Test func aHeldTimerKeepsTheTimeThatWasLeft() {
        var timer = ToastTimer(lifetime: .seconds(3))
        timer.hold(afterRunning: .seconds(1))
        #expect(timer.isHeld)
        #expect(timer.remaining == .seconds(2))
        timer.release()
        #expect(!timer.isHeld)
        #expect(timer.remaining == .seconds(2))
    }

    @Test func aReleaseNearTheEndLeavesTheMinimum() {
        var timer = ToastTimer(lifetime: .seconds(3))
        timer.hold(afterRunning: .milliseconds(2_900))
        timer.release()
        #expect(timer.remaining == ToastTimer.minimumAfterHold)
    }

    @Test func aSecondHoldCountsOnlyTheTimeSinceTheRelease() {
        var timer = ToastTimer(lifetime: .seconds(4))
        timer.hold(afterRunning: .seconds(1))
        timer.release()
        timer.hold(afterRunning: .milliseconds(500))
        #expect(timer.remaining == .milliseconds(2_500))
        timer.hold(afterRunning: .seconds(1))  // a second finger while held changes nothing
        #expect(timer.remaining == .milliseconds(2_500))
    }

    // MARK: Toast rules

    @Test func anActionToastStaysWhileVoiceOverRuns() {
        let undoable = Toast(verbatim: "Set deleted", action: .init(verbatim: "Undo") {})
        let plain = Toast(verbatim: "Saved")
        #expect(undoable.lifetime(screenReaderRunning: true) == nil)
        #expect(undoable.lifetime(screenReaderRunning: false) == undoable.duration)
        #expect(plain.lifetime(screenReaderRunning: true) == plain.duration)
    }

    @Test func onlySuccessAndDangerPlayAndARepeatToneBuzzesOnce() {
        #expect(Toast(verbatim: "Saved", tone: .success).shouldPlayFeedback(replacing: nil))
        #expect(Toast(verbatim: "Failed", tone: .danger).shouldPlayFeedback(replacing: .success))
        #expect(!Toast(verbatim: "Saved", tone: .success).shouldPlayFeedback(replacing: .success))
        #expect(!Toast(verbatim: "Note", tone: .neutral).shouldPlayFeedback(replacing: nil))
        #expect(!Toast(verbatim: "Careful", tone: .warning).shouldPlayFeedback(replacing: nil))
        #expect(!Toast(verbatim: "Saved", tone: .success, playsFeedback: false).shouldPlayFeedback(replacing: nil))
    }

    // MARK: ToastWidth

    @Test func theWidthStopsBeforeTheBarButtonsWithAFloor() {
        #expect(ToastWidth.edgeReserve == Space.gutter + Size.minTouch + Space.md)
        #expect(ToastWidth.maxWidth(containerWidth: 402) == 402 - 2 * ToastWidth.edgeReserve)
        #expect(ToastWidth.maxWidth(containerWidth: 200) == ToastWidth.minimumLimit)
        let phone: CGFloat = 402 - 2 * Space.gutter
        let cap = ToastWidth.maxWidth(containerWidth: 402)
        #expect(ToastWidth.width(idealWidth: 120, proposedWidth: phone) == 120)
        #expect(ToastWidth.width(idealWidth: cap + 40, proposedWidth: phone) == cap)
        #expect(ToastWidth.width(idealWidth: 281, proposedWidth: 150) == 150)
        #expect(ToastWidth.width(idealWidth: 281, proposedWidth: nil) == 281)
        #expect(ToastWidth.width(idealWidth: 281, proposedWidth: .infinity) == 281)
    }

    @Test func theMessageWrapsToTwoLinesExceptAtAccessibilitySizes() {
        #expect(ToastWidth.lineLimit(isAccessibilitySize: false) == 2)
        #expect(ToastWidth.lineLimit(isAccessibilitySize: true) == nil)
    }

    // MARK: ToastCenter

    @Test func aFingerOnTheToastStopsItsTimerAndTheReleaseResumesIt() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        let toast = Toast(verbatim: "Saved", duration: .seconds(4))
        center.show(toast)
        await clock.waitForSleepers(1)
        clock.advance(by: .seconds(1))
        await settle()

        center.hold(toast.id)
        #expect(clock.sleeperCount == 0)
        clock.advance(by: .seconds(30))
        await settle()
        #expect(center.current == toast)

        center.release(toast.id)
        await clock.waitForSleepers(1)
        clock.advance(by: .milliseconds(2_900))
        await settle()
        #expect(center.current == toast)
        clock.advance(by: .milliseconds(100))
        await eventually { center.current == nil }
        #expect(center.current == nil)
    }

    @Test func aHoldOnAReplacedToastChangesNothing() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        let first = Toast(verbatim: "First")
        let second = Toast(verbatim: "Second", duration: .seconds(2))
        center.show(first)
        center.show(second)
        center.hold(first.id)
        await clock.waitForSleepers(1)
        clock.advance(by: .seconds(2))
        await eventually { center.current == nil }
        #expect(center.current == nil)
    }

    @Test func withVoiceOverAnActionToastWaitsForTheUser() async {
        let clock = TestClock()
        let center = ToastCenter(clock: clock)
        center.isScreenReaderRunning = true
        let toast = Toast(verbatim: "Set deleted", action: .init(verbatim: "Undo") {})
        center.show(toast)
        await settle()
        #expect(clock.sleeperCount == 0)
        clock.advance(by: .seconds(60))
        await settle()
        #expect(center.current == toast)
        center.dismiss(toast.id)
        #expect(center.current == nil)
    }
}
