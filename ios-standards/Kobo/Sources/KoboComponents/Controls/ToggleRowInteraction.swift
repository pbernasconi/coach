import Foundation

/// How a `ToggleRow` takes part while a save runs. A row that is off limits for good (a policy lock) is
/// `.disabled(true)` at the call site instead: that is the only state that dims the row.
nonisolated public enum ToggleRowInteraction: Sendable, Equatable, CaseIterable {
    /// The row takes taps.
    case enabled
    /// Another row is saving: this one keeps its full ink but takes no taps.
    case waiting
    /// This row is saving: the switch shows the tapped value at once, a small spinner takes the switch's place only if
    /// the save is still running after `Motion.Duration.spinnerDelay`, and the row takes no taps.
    case saving

    /// Only an idle row takes taps, so a second tap never starts a second save.
    var acceptsTaps: Bool { self == .enabled }
}

/// A tap whose save has not answered yet. While the row saves, the switch draws the tapped value, so the knob moves
/// at the tap. The first change of the bound value ends the tap (the optimistic write, or a failed save that put the
/// old value back), so the stored value always wins. Ported from an earlier app's `ToggleRowLook.PendingTap`.
nonisolated struct ToggleRowPendingTap: Equatable, Sendable {
    /// A tap is waiting for its save.
    private(set) var isPending = false
    /// The value that tap asked for.
    private(set) var value = false

    /// The person tapped the switch away from `isOn`.
    mutating func tap(from isOn: Bool) {
        isPending = true
        value = !isOn
    }

    /// The bound value changed, or the save ended: from now on the switch draws the bound value.
    mutating func end() {
        isPending = false
    }

    /// The value the switch draws.
    func displayed(isOn: Bool, interaction: ToggleRowInteraction) -> Bool {
        interaction == .saving && isPending ? value : isOn
    }
}
