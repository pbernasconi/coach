import Testing

@testable import KoboComponents

@Suite struct SelectionCheckboxStateTests {
    @Test func boolMapsToCheckedOrUnchecked() {
        #expect(CheckboxState(true) == .checked)
        #expect(CheckboxState(false) == .unchecked)
    }

    @Test(arguments: [
        ([Bool](), CheckboxState.unchecked),
        ([false, false], .unchecked),
        ([true, true, true], .checked),
        ([true, false, true], .mixed),
        ([false, true], .mixed),
    ])
    func parentStateFollowsItsChildren(children: [Bool], expected: CheckboxState) {
        #expect(CheckboxState(children: children) == expected)
    }

    @Test func aTapTurnsMixedAndUncheckedOnAndCheckedOff() {
        #expect(CheckboxState.unchecked.toggled == .checked)
        #expect(CheckboxState.mixed.toggled == .checked)
        #expect(CheckboxState.checked.toggled == .unchecked)
    }

    @Test func onlyCheckedIsOn() {
        #expect(CheckboxState.checked.isOn)
        #expect(!CheckboxState.mixed.isOn)
        #expect(!CheckboxState.unchecked.isOn)
    }
}
