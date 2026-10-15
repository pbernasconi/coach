import Foundation

/// The typed shape of a `DateField`: the order of day, month and year and the mark between them, taken from the
/// region ("07/24/2026" in the US, "24.07.2026" in Germany, "2026/07/24" in Japan). Day and month take two digits,
/// the year four, so the mask works with a number pad alone.
nonisolated public struct DateFieldPattern: Hashable, Sendable {
    /// The order of the three parts.
    public enum Order: Hashable, Sendable, CaseIterable {
        case monthDayYear, dayMonthYear, yearMonthDay
    }

    /// One part of the date.
    enum Part: Hashable, Sendable {
        case day, month, year

        var width: Int { self == .year ? 4 : 2 }
    }

    public var order: Order
    public var separator: Character

    public init(order: Order, separator: Character) {
        self.order = order
        self.separator = separator
    }

    /// The pattern a region writes numeric dates in. Falls back to month/day/year with `/`.
    public init(locale: Locale) {
        let format = DateFormatter.dateFormat(fromTemplate: "MMddyyyy", options: 0, locale: locale) ?? ""
        self = Self.parse(format) ?? DateFieldPattern(order: .monthDayYear, separator: "/")
    }

    /// The pattern behind a `DateFormatter` format such as `"dd.MM.yyyy"`, or `nil` when it is not three numeric parts.
    static func parse(_ format: String) -> DateFieldPattern? {
        let lowered = format.lowercased()
        guard let year = lowered.firstIndex(of: "y"), let month = lowered.firstIndex(of: "m"),
            let day = lowered.firstIndex(of: "d")
        else { return nil }
        let order: Order
        if year < month && month < day {
            order = .yearMonthDay
        } else if day < month && month < year {
            order = .dayMonthYear
        } else if month < day && day < year {
            order = .monthDayYear
        } else {
            return nil
        }
        let mark = lowered.first { !$0.isLetter && !$0.isWhitespace && $0 != "'" }
        return DateFieldPattern(order: order, separator: mark ?? "/")
    }

    var parts: [Part] {
        switch order {
        case .monthDayYear: [.month, .day, .year]
        case .dayMonthYear: [.day, .month, .year]
        case .yearMonthDay: [.year, .month, .day]
        }
    }

    /// The digits a full date has (eight).
    var digitCount: Int { parts.reduce(0) { $0 + $1.width } }

    /// The shape as a prompt: "MM/DD/YYYY", "DD.MM.YYYY".
    public var hint: String {
        parts.map { part in
            switch part {
            case .day: "DD"
            case .month: "MM"
            case .year: "YYYY"
            }
        }
        .joined(separator: String(separator))
    }

    /// Digits only, the separator after each full part, at most eight digits: "0724" → "07/24".
    func mask(_ text: String) -> String {
        var digits = Substring(text.filter(NumberGrouping.isDigit).prefix(digitCount))
        var groups: [Substring] = []
        for part in parts where !digits.isEmpty {
            groups.append(digits.prefix(part.width))
            digits = digits.dropFirst(part.width)
        }
        return groups.joined(separator: String(separator))
    }

    /// The text for a day: "07/24/2026".
    func format(year: Int, month: Int, day: Int) -> String {
        parts.map { part in
            switch part {
            case .day: Self.padded(day, to: 2)
            case .month: Self.padded(month, to: 2)
            case .year: Self.padded(year, to: 4)
            }
        }
        .joined(separator: String(separator))
    }

    /// Year, month and day of a complete masked text, in this pattern's order.
    func components(of text: String) -> (year: Int, month: Int, day: Int)? {
        let numbers = mask(text).split(separator: separator).compactMap { Int($0) }
        guard numbers.count == 3 else { return nil }
        let values = Dictionary(uniqueKeysWithValues: zip(parts, numbers))
        guard let year = values[.year], let month = values[.month], let day = values[.day] else { return nil }
        return (year, month, day)
    }

    private static func padded(_ number: Int, to width: Int) -> String {
        let digits = String(number)
        return String(repeating: "0", count: max(width - digits.count, 0)) + digits
    }
}
