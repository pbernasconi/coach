import Foundation

/// Turns what the keyboard produced into canonical number text (ASCII digits and one `.`) before `NumberEntryLogic`
/// reads it. A decimal pad types the region's decimal separator, so in Germany "12,5" is twelve and a half, and the
/// field shows grouping in the region's style ("1.234,5"). An edit keeps the meaning of the text the field showed; a
/// paste is read with `normalized`.
nonisolated enum LocalizedNumberText {
    /// The separators a region uses: what the decimal pad types, and what groups thousands (`nil` for none).
    struct Separators: Equatable, Sendable {
        var decimal: Character
        var grouping: Character?

        /// The separators of `locale`.
        init(locale: Locale) {
            decimal = locale.decimalSeparator?.first ?? "."
            let grouping = locale.groupingSeparator?.first
            self.grouping = grouping == decimal ? nil : grouping
        }

        init(decimal: Character, grouping: Character?) {
            self.decimal = decimal
            self.grouping = grouping
        }
    }

    /// The edit from `previous` (the shown text) to `typed`, in canonical terms. A single typed character keeps the
    /// display meaning of the text around it, so a deletion in "1,234" gives "123". A typed decimal separator, or a dot
    /// or comma that is not the region's grouping mark, becomes the decimal point; a typed grouping mark is dropped. A
    /// longer insertion is a paste, and the whole text is read with `normalized`.
    static func applied(previous: String, typed: String, separators: Separators, maxDecimals: Int) -> String {
        let prefix = zip(previous, typed).prefix(while: { $0 == $1 }).count
        let room = min(previous.count, typed.count) - prefix
        let suffix = zip(previous.reversed(), typed.reversed()).prefix(room).prefix(while: { $0 == $1 }).count
        let inserted = typed.dropFirst(prefix).dropLast(suffix)
        if inserted.count > 1 { return normalized(typed, separators: separators, maxDecimals: maxDecimals) }
        let middle = inserted.first.map { insertedText($0, separators: separators) } ?? ""
        return canonical(typed.prefix(prefix), separators) + middle + canonical(typed.suffix(suffix), separators)
    }

    /// Pasted text in canonical terms. Every character other than digits, `.`, `,` and the decimal separator goes
    /// (signs, spaces, no-break spaces, apostrophes, letters). With both marks present the last one is the decimal
    /// point; the region's decimal separator is the decimal point; the other mark is the decimal point only when used
    /// once with at most `maxDecimals` digits after it ("12,5" → 12.5), else it groups ("12,345" → 12345).
    static func normalized(_ text: String, separators: Separators, maxDecimals: Int) -> String {
        let decimalMark = separators.decimal
        let kept = text.filter { NumberGrouping.isDigit($0) || $0 == "." || $0 == "," || $0 == decimalMark }
        let marks = kept.filter { !NumberGrouping.isDigit($0) }
        guard let mark = marks.last else { return kept }
        let decimal: Character?
        if Set(marks).count > 1 || mark == decimalMark {
            decimal = mark
        } else {
            let digitsAfter = kept.reversed().prefix(while: NumberGrouping.isDigit).count
            let fits = digitsAfter <= maxDecimals && (digitsAfter > 0 || mark == ".")
            decimal = marks.count == 1 && fits ? mark : nil
        }
        return String(kept.compactMap { NumberGrouping.isDigit($0) ? $0 : $0 == decimal ? "." : nil })
    }

    /// Shown text in canonical terms: the grouping marks go, the decimal separator becomes `.`.
    private static func canonical(_ text: Substring, _ separators: Separators) -> String {
        String(text.compactMap { NumberGrouping.isDigit($0) ? $0 : $0 == separators.decimal ? "." : nil })
    }

    private static func insertedText(_ character: Character, separators: Separators) -> String {
        if NumberGrouping.isDigit(character) { return String(character) }
        if character == separators.decimal { return "." }
        let isMark = character == "." || character == ","
        return isMark && character != separators.grouping ? "." : ""
    }
}
