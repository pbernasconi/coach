import Foundation

/// How many chips of a group can be on.
nonisolated public enum SelectionMode: Sendable, Equatable, CaseIterable {
    /// Exactly one: tapping the selected chip keeps it (a radio group).
    case single
    /// At most one: tapping the selected chip clears it.
    case singleOrNone
    /// Any number: each tap toggles its chip (a checkbox group).
    case multiple
}

/// The pure selection rule of a `ChipGroup`.
nonisolated enum ChipSelection {
    /// The selection after a tap on `value`.
    static func toggled<Value: Hashable>(_ value: Value, in selection: Set<Value>, mode: SelectionMode) -> Set<Value> {
        let isOn = selection.contains(value)
        switch mode {
        case .single:
            return [value]
        case .singleOrNone:
            return isOn ? [] : [value]
        case .multiple:
            var next = selection
            if isOn { next.remove(value) } else { next.insert(value) }
            return next
        }
    }
}
