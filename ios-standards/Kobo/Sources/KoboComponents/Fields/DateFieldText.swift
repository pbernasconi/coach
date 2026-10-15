import Foundation

/// The text a `DateField` shows, kept apart from the date the caller holds. A complete valid date reports once; a
/// rejected one reports `nil` and keeps the text; a partial one reports nothing and, on blur, changes back to the held
/// date. A date set from outside replaces the text unless it echoes the last report.
nonisolated struct DateFieldText: Sendable {
    /// A new value for the caller.
    struct Change: Equatable, Sendable {
        let date: Date?
    }

    var text: String
    private var lastReported: Date?
    let pattern: DateFieldPattern
    let calendar: Calendar

    init(value: Date?, pattern: DateFieldPattern, calendar: Calendar) {
        self.pattern = pattern
        self.calendar = calendar
        text = DateFieldLogic.format(value, pattern: pattern, calendar: calendar)
        lastReported = value.map(calendar.startOfDay)
    }

    func evaluate(_ bounds: DateBounds) -> DateFieldLogic.Evaluation {
        DateFieldLogic.evaluate(text, pattern: pattern, bounds: bounds, calendar: calendar)
    }

    /// Masks or parses what the keyboard produced.
    mutating func normalize() {
        let normalized = DateFieldLogic.normalize(text, pattern: pattern, calendar: calendar)
        if normalized != text { text = normalized }
    }

    /// The change the current text asks for under `bounds`, or `nil`. Run it after an edit and when a bound moves.
    mutating func settle(_ bounds: DateBounds) -> Change? {
        switch evaluate(bounds) {
        case .invalid, .beforeMin, .afterMax, .unavailable:
            guard lastReported != nil else { return nil }
            lastReported = nil
            return Change(date: nil)
        case .valid(let date):
            guard date != lastReported else { return nil }
            lastReported = date
            return Change(date: date)
        case .empty, .incomplete:
            return nil
        }
    }

    /// A calendar or quick pick.
    mutating func pick(_ date: Date) -> Change {
        let day = calendar.startOfDay(for: date)
        lastReported = day
        text = DateFieldLogic.format(day, pattern: pattern, calendar: calendar)
        return Change(date: day)
    }

    /// A partial or empty entry changes back to the held date; a complete one stays as typed.
    mutating func blurred(held: Date?) {
        switch evaluate(DateBounds()) {
        case .empty, .incomplete: text = DateFieldLogic.format(held, pattern: pattern, calendar: calendar)
        default: break
        }
    }

    /// Takes a date set from outside, unless it echoes the last report.
    mutating func sync(_ value: Date?) {
        guard value.map(calendar.startOfDay) != lastReported else { return }
        self = DateFieldText(value: value, pattern: pattern, calendar: calendar)
    }
}
