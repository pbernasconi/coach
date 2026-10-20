import Testing

@testable import KoboComponents

/// A press you can always see, and never a flicker.
@Suite struct ControlsPressFillTests {
    @Test func aQuickTapShowsTheWholeFillBeforeItFades() {
        var schedule = PressFillSchedule()
        schedule.pressIn()
        schedule.release()
        #expect(schedule.isShown)
        schedule.arrived(press: schedule.press)
        #expect(!schedule.isShown)
    }

    @Test func aHeldPressKeepsTheFillUntilTheRelease() {
        var schedule = PressFillSchedule()
        schedule.pressIn()
        schedule.arrived(press: schedule.press)
        #expect(schedule.isShown)
        schedule.release()
        #expect(!schedule.isShown)
    }

    @Test func theEndOfAnOldFadeInDoesNotEndANewerPress() {
        var schedule = PressFillSchedule()
        schedule.pressIn()
        let first = schedule.press
        schedule.release()
        schedule.pressIn()
        schedule.arrived(press: first)
        #expect(schedule.isShown)
        schedule.release()
        #expect(schedule.isShown)
        schedule.arrived(press: schedule.press)
        #expect(!schedule.isShown)
    }

    @Test func pressesAreCounted() {
        var schedule = PressFillSchedule()
        #expect(schedule.press == 0)
        schedule.pressIn()
        schedule.pressIn()
        #expect(schedule.press == 2)
    }
}
