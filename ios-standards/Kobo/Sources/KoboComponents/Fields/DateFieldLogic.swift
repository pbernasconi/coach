import Foundation

/// Typed entry for a `DateField`, in the region's order. A partial date is not an error, and a rejected date is
/// never moved to the nearest allowed day.
nonisolated enum DateFieldLogic {
    /// What the typed text amounts to.
    enum Evaluation: Equatable, Sendable {
        case empty, incomplete, invalid
        case beforeMin(Date), afterMax(Date), unavailable(Date)
        case valid(Date)

        /// The day behind a complete, real date, whether or not the bounds accept it.
        var date: Date? {
            switch self {
            case .beforeMin(let date), .afterMax(let date), .unavailable(let date), .valid(let date): date
            case .empty, .incomplete, .invalid: nil
            }
        }
    }

    /// Midnight on a real calendar day, or `nil` for 31 April, 29 February 2027, month 13.
    static func date(year: Int, month: Int, day: Int, calendar: Calendar) -> Date? {
        let parts = DateComponents(year: year, month: month, day: day)
        guard let date = calendar.date(from: parts) else { return nil }
        let back = calendar.dateComponents([.year, .month, .day], from: date)
        guard back.year == year, back.month == month, back.day == day else { return nil }
        return calendar.startOfDay(for: date)
    }

    /// The field text for what the keyboard produced. Mask-shaped text is typing: "12/25/19" is a backspace state, not
    /// the year 2019. Only text the mask could not produce is offered to the paste formats.
    static func normalize(_ raw: String, pattern: DateFieldPattern, calendar: Calendar) -> String {
        let masked = pattern.mask(raw)
        guard masked != raw, let pasted = DatePasteParser.parse(raw, pattern: pattern, calendar: calendar) else {
            return masked
        }
        return format(pasted, pattern: pattern, calendar: calendar)
    }

    /// The text for a day the caller holds (a prefill, a calendar pick, a blur restore). `nil` gives `""`.
    static func format(_ date: Date?, pattern: DateFieldPattern, calendar: Calendar) -> String {
        guard let date else { return "" }
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = parts.year, let month = parts.month, let day = parts.day else { return "" }
        return pattern.format(year: year, month: month, day: day)
    }

    /// What `text` amounts to under `bounds`. The bounds are checked before the disabled-day rule, so the rule is
    /// never asked about a day outside them.
    static func evaluate(_ text: String, pattern: DateFieldPattern, bounds: DateBounds, calendar: Calendar)
        -> Evaluation
    {
        let digits = text.filter(NumberGrouping.isDigit)
        guard !digits.isEmpty else { return .empty }
        guard digits.count >= pattern.digitCount else { return .incomplete }
        guard let parts = pattern.components(of: text),
            let date = date(year: parts.year, month: parts.month, day: parts.day, calendar: calendar)
        else { return .invalid }
        if bounds.isBeforeMin(date, calendar: calendar) { return .beforeMin(date) }
        if bounds.isAfterMax(date, calendar: calendar) { return .afterMax(date) }
        if bounds.isDateDisabled?(date) ?? false { return .unavailable(date) }
        return .valid(date)
    }

    /// The message to show, or `nil` while there is nothing to complain about.
    static func errorMessage(_ evaluation: Evaluation, messages: DateFieldMessages) -> String? {
        switch evaluation {
        case .empty, .incomplete, .valid: nil
        case .invalid: messages.invalid
        case .beforeMin: messages.beforeMin
        case .afterMax: messages.afterMax
        case .unavailable: messages.unavailable
        }
    }
}

/// The copy a `DateField` shows for a rejected typed date. Override any line per field ("Pick a day after today").
nonisolated public struct DateFieldMessages: Hashable, Sendable {
    public var invalid: String
    public var beforeMin: String
    public var afterMax: String
    public var unavailable: String

    public init(invalid: String, beforeMin: String, afterMax: String, unavailable: String) {
        self.invalid = invalid
        self.beforeMin = beforeMin
        self.afterMax = afterMax
        self.unavailable = unavailable
    }

    /// The library's own lines, from Kobo's String Catalog.
    @MainActor public static var standard: DateFieldMessages {
        DateFieldMessages(
            invalid: String(localized: "Enter a real date", bundle: .module),
            beforeMin: String(localized: "That date is too early", bundle: .module),
            afterMax: String(localized: "That date is too late", bundle: .module),
            unavailable: String(localized: "That date isn't available", bundle: .module)
        )
    }
}
