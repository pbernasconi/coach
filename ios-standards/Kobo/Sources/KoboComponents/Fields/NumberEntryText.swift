import Foundation

/// The text a `NumberEntry` shows and the canonical number behind it. Every edit, typed, pasted or pressed on the
/// keypad, is sanitised back into the canonical value, and the shown text is rebuilt from it in the region's style.
/// An edit that would go above the upper bound is refused (the field shakes); one below the lower bound is kept while
/// the user types and raised on commit.
nonisolated struct NumberEntryText: Equatable, Sendable {
    /// What changed after an edit.
    struct Change: Equatable, Sendable {
        /// The number to report: `nil` when the field is empty.
        let number: Double?
        /// False when only the shown text was cleaned up, so the caller hears one report per real edit.
        let valueChanged: Bool
        /// A cut or refused edit: shake and play `.error`.
        let shakes: Bool
    }

    /// The text the field shows (and the keyboard edits).
    var text: String
    private(set) var value: String
    let rules: NumberEntryRules
    let separators: LocalizedNumberText.Separators

    init(number: Double?, rules: NumberEntryRules, separators: LocalizedNumberText.Separators) {
        self.rules = rules
        self.separators = separators
        value = NumberEntryLogic.canonical(number, decimalPlaces: rules.decimalPlaces)
        text = NumberEntryLogic.display(value, separators: separators)
    }

    /// The number the canonical value means, or `nil` while empty.
    var number: Double? { NumberEntryLogic.number(value) }

    /// Cleans `text` after the keyboard changed it. `nil` when nothing happened (the echo of a clean-up).
    mutating func normalize() -> Change? {
        let previous = NumberEntryLogic.display(value, separators: separators)
        let typed = LocalizedNumberText.applied(
            previous: previous,
            typed: text,
            separators: separators,
            maxDecimals: rules.decimalPlaces
        )
        return apply(NumberEntryLogic.sanitize(typed, rules: rules))
    }

    /// Applies one keypad key.
    mutating func press(_ key: NumberEntryKey) -> Change? {
        apply(NumberEntryLogic.pressing(key, on: value, rules: rules))
    }

    /// Clamps and rounds on commit (Done, blur), and reports the stored number if it moved.
    mutating func commit() -> Change? {
        guard let number else { return nil }
        let stored = NumberEntryLogic.committed(number, rules: rules)
        let next = NumberEntryLogic.canonical(stored, decimalPlaces: rules.decimalPlaces)
        let changed = next != value
        value = next
        text = NumberEntryLogic.display(value, separators: separators)
        return changed ? Change(number: stored, valueChanged: true, shakes: false) : nil
    }

    /// Takes a number set from outside (a stepper, a reset) unless it is the one already shown.
    mutating func sync(_ number: Double?) {
        guard number != self.number else { return }
        self = NumberEntryText(number: number, rules: rules, separators: separators)
    }

    /// Takes the edit unless it goes above the upper bound, then rebuilds the shown text from the value.
    private mutating func apply(_ edit: NumberEntryLogic.Edit) -> Change? {
        let refused = NumberEntryLogic.isOver(edit.value, rules: rules)
        let next = refused ? value : edit.value
        let valueChanged = next != value
        value = next
        let shown = NumberEntryLogic.display(value, separators: separators)
        if text != shown { text = shown }
        guard valueChanged || edit.rejected || refused else { return nil }
        return Change(number: number, valueChanged: valueChanged, shakes: edit.rejected || refused)
    }
}
