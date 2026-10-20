import Testing

@testable import KoboComponents

/// A saving row shows the tapped value, and the stored value always wins.
@Suite struct ControlsToggleRowTests {
    @Test func onlyAnIdleRowTakesTaps() {
        #expect(ToggleRowInteraction.enabled.acceptsTaps)
        #expect(!ToggleRowInteraction.waiting.acceptsTaps)
        #expect(!ToggleRowInteraction.saving.acceptsTaps)
    }

    @Test func aSavingRowDrawsTheTappedValue() {
        var tap = ToggleRowPendingTap()
        tap.tap(from: false)
        #expect(tap.displayed(isOn: false, interaction: .saving))
        // Outside a save the switch always draws the bound value.
        #expect(!tap.displayed(isOn: false, interaction: .enabled))
        #expect(!tap.displayed(isOn: false, interaction: .waiting))
    }

    @Test func theBoundValueWinsOnceTheTapEnds() {
        var tap = ToggleRowPendingTap()
        tap.tap(from: true)
        #expect(!tap.displayed(isOn: true, interaction: .saving))
        // A failed save puts the old value back: the tap ends and the switch follows the bound value.
        tap.end()
        #expect(tap.displayed(isOn: true, interaction: .saving))
    }

    @Test func withNoTapTheSwitchDrawsTheBoundValue() {
        let tap = ToggleRowPendingTap()
        #expect(tap.displayed(isOn: true, interaction: .saving))
        #expect(!tap.displayed(isOn: false, interaction: .saving))
    }
}
