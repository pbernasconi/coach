@testable import Lift

/// A `PracticeModeSwitching` that records each switch it is asked for, in order.
@MainActor
final class RecordingPracticeModeSwitch: PracticeModeSwitching {
    private(set) var calls: [Bool] = []

    func setPracticeMode(_ isOn: Bool) {
        calls.append(isOn)
    }
}
