import Foundation

/// The rules of a `NumberEntry`: how many digits fit, how many decimals, and the range. Pure, so the keypad, the
/// keyboard and paste all share one tested path.
///
///     NumberEntryRules(range: 0...500, decimalPlaces: 1)   // up to "500.0"; 3 whole digits, 1 decimal
nonisolated struct NumberEntryRules: Hashable, Sendable {
    /// The allowed values. An edit above the upper bound is refused; a value below the lower bound is raised on commit.
    var range: ClosedRange<Double>
    /// Fraction digits a user may type (0 for whole numbers).
    var decimalPlaces: Int
    /// Whole digits a user may type: by default just enough for the upper bound (500 → 3).
    var maxIntegerDigits: Int

    init(range: ClosedRange<Double>, decimalPlaces: Int = 0, maxIntegerDigits: Int? = nil) {
        self.range = range
        self.decimalPlaces = max(decimalPlaces, 0)
        self.maxIntegerDigits = max(maxIntegerDigits ?? Self.integerDigits(of: range.upperBound), 1)
    }

    /// The whole digits of `value`'s magnitude: 500 → 3, 0.5 → 1, 10 000 → 5.
    static func integerDigits(of value: Double) -> Int {
        guard value.isFinite, value.magnitude >= 1 else { return 1 }
        return String(Int(value.magnitude.rounded(.down))).count
    }
}

/// Canonical-text maths for `NumberEntry`. The canonical value has ASCII digits and at most one `.`: `""`, `"0"`,
/// `"105"`, `"102.5"`, `"102."`. The shown text is derived from it and never stored.
nonisolated enum NumberEntryLogic {
    /// One edit: the next canonical value, and whether the input was cut (the field shakes and plays `.error`).
    struct Edit: Equatable, Sendable {
        let value: String
        let rejected: Bool
    }

    /// Normalises the whole canonical-terms text. Too many whole digits, an extra decimal or a second dot are cut to
    /// the legal prefix and flagged; anything that is not a digit or a dot is dropped silently.
    static func sanitize(_ typed: String, rules: NumberEntryRules) -> Edit {
        let cleaned = NumberGrouping.digitsAndDots(typed)
        guard let dot = cleaned.firstIndex(of: ".") else {
            let integer = NumberGrouping.withoutLeadingZeros(Substring(cleaned))
            let cut = integer.count > rules.maxIntegerDigits
            return Edit(value: String(integer.prefix(rules.maxIntegerDigits)), rejected: cut)
        }
        let afterDot = cleaned[cleaned.index(after: dot)...]
        let extraDots = afterDot.contains(".")
        let fraction = afterDot.filter { $0 != "." }
        let integer = NumberGrouping.withoutLeadingZeros(cleaned[..<dot])
        guard rules.decimalPlaces > 0 else {
            // A whole-number field has no decimal point: the dot and what follows it are cut.
            return Edit(value: String(integer.prefix(rules.maxIntegerDigits)), rejected: true)
        }
        let rejected = integer.count > rules.maxIntegerDigits || fraction.count > rules.decimalPlaces || extraDots
        let whole = integer.isEmpty ? "0" : String(integer.prefix(rules.maxIntegerDigits))
        return Edit(value: "\(whole).\(fraction.prefix(rules.decimalPlaces))", rejected: rejected)
    }

    /// The value after a keypad key.
    static func pressing(_ key: NumberEntryKey, on value: String, rules: NumberEntryRules) -> Edit {
        switch key {
        case .digit(let digit):
            guard (0...9).contains(digit) else { return Edit(value: value, rejected: true) }
            return sanitize(value + String(digit), rules: rules)
        case .decimal:
            guard !value.contains(".") else { return Edit(value: value, rejected: true) }
            return sanitize(value + ".", rules: rules)
        case .delete:
            guard !value.isEmpty else { return Edit(value: value, rejected: true) }
            return Edit(value: String(value.dropLast()), rejected: false)
        }
    }

    /// The number a canonical value means, or `nil` while it is empty. `"0."` and `"."` read as 0.
    static func number(_ value: String) -> Double? {
        guard !value.isEmpty else { return nil }
        let padded = value.hasSuffix(".") ? value + "0" : value
        return Double(padded.hasPrefix(".") ? "0" + padded : padded)
    }

    /// The canonical text of `number`, rounded to `decimalPlaces` with no trailing zeros: 102.50 → `"102.5"`, 100 →
    /// `"100"`. Negative and non-finite numbers give `""`.
    static func canonical(_ number: Double?, decimalPlaces: Int) -> String {
        guard let number, number.isFinite, number >= 0 else { return "" }
        let scale = pow(10, Double(decimalPlaces))
        let scaled = (number * scale).rounded()
        let whole = Int((scaled / scale).rounded(.down))
        var fraction = String(Int(scaled - Double(whole) * scale))
        guard decimalPlaces > 0, fraction != "0" else { return String(whole) }
        fraction = String(repeating: "0", count: max(decimalPlaces - fraction.count, 0)) + fraction
        while fraction.hasSuffix("0") { fraction.removeLast() }
        return "\(whole).\(fraction)"
    }

    /// The shown text: grouped whole digits, and a trailing separator or partial decimals kept as typed. Empty stays
    /// empty, so the "0" placeholder shows.
    static func display(_ value: String, separators: LocalizedNumberText.Separators) -> String {
        guard !value.isEmpty else { return "" }
        guard let dot = value.firstIndex(of: ".") else {
            return NumberGrouping.grouped(Substring(value), separator: separators.grouping)
        }
        let integer = value[..<dot]
        let whole = NumberGrouping.grouped(integer.isEmpty ? "0" : integer, separator: separators.grouping)
        return whole + String(separators.decimal) + value[value.index(after: dot)...]
    }

    /// The value a commit stores: clamped to `rules.range` and rounded to `rules.decimalPlaces`.
    static func committed(_ number: Double, rules: NumberEntryRules) -> Double {
        let scale = pow(10, Double(rules.decimalPlaces))
        let rounded = (number * scale).rounded() / scale
        return min(max(rounded, rules.range.lowerBound), rules.range.upperBound)
    }

    /// True while `value` is above the upper bound.
    static func isOver(_ value: String, rules: NumberEntryRules) -> Bool {
        guard let number = number(value) else { return false }
        return number > rules.range.upperBound
    }
}
