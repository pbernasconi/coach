import Foundation

/// The three states of a checkbox: off, on, or mixed (a parent whose children are only partly on). A mixed box is
/// drawn with a dash and speaks "Mixed"; a tap on it turns it on.
///
///     KoboCheckbox("All equipment", state: $allEquipment)
///     CheckboxState(children: equipment.map(\.isOwned))   // .mixed when some, not all, are on
nonisolated public enum CheckboxState: Sendable, Hashable, CaseIterable {
    /// Off.
    case unchecked
    /// On.
    case checked
    /// Partly on: some of the children it stands for are on, some are off.
    case mixed

    /// `.checked` for `true`, `.unchecked` for `false`.
    public init(_ isOn: Bool) {
        self = isOn ? .checked : .unchecked
    }

    /// The state of a parent over `children`: checked when every child is on, unchecked when none is (or there are
    /// none), mixed otherwise.
    public init<Children: Sequence>(children: Children) where Children.Element == Bool {
        var sawOn = false
        var sawOff = false
        for child in children {
            if child { sawOn = true } else { sawOff = true }
            if sawOn && sawOff { break }
        }
        switch (sawOn, sawOff) {
        case (true, true): self = .mixed
        case (true, false): self = .checked
        default: self = .unchecked
        }
    }

    /// The state after a tap: an unchecked or mixed box turns on, a checked one turns off.
    public var toggled: CheckboxState {
        self == .checked ? .unchecked : .checked
    }

    /// True only for `.checked`.
    public var isOn: Bool { self == .checked }
}
