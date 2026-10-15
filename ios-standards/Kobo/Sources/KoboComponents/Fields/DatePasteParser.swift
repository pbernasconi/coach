import Foundation

/// The pasted dates a `DateField` reads besides its own mask: ISO `2026-07-24`, short numeric dates in the region's
/// order (`7/24/2026`, `24.7.26`) and spelled months in the calendar's language (`Jul 24, 2026`, `24 July 2026`).
nonisolated enum DatePasteParser {
    /// A two-digit year above this is 19xx; this or below is 20xx.
    static let twoDigitCutoff = 60

    static func parse(_ text: String, pattern: DateFieldPattern, calendar: Calendar) -> Date? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return iso(trimmed, calendar: calendar)
            ?? numeric(trimmed, pattern: pattern, calendar: calendar)
            ?? spelled(trimmed, calendar: calendar)
    }

    /// `yyyy-MM-dd`.
    private static func iso(_ text: String, calendar: Calendar) -> Date? {
        let parts = text.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, isDigits(parts[0], 4...4), isDigits(parts[1], 2...2), isDigits(parts[2], 2...2),
            let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2])
        else { return nil }
        return DateFieldLogic.date(year: year, month: month, day: day, calendar: calendar)
    }

    /// One- or two-digit day and month and a two-to-four-digit year, in the pattern's order, split by `/`, `.` or `-`.
    private static func numeric(_ text: String, pattern: DateFieldPattern, calendar: Calendar) -> Date? {
        let parts = text.split(omittingEmptySubsequences: false) { $0 == "/" || $0 == "." || $0 == "-" }
        guard parts.count == 3 else { return nil }
        let named = Dictionary(uniqueKeysWithValues: zip(pattern.parts, parts))
        guard let dayText = named[.day], let monthText = named[.month], let yearText = named[.year],
            isDigits(dayText, 1...2), isDigits(monthText, 1...2), isDigits(yearText, 2...4),
            let day = Int(dayText), let month = Int(monthText), let typedYear = Int(yearText)
        else { return nil }
        let year = yearText.count == 2 ? (typedYear > twoDigitCutoff ? 1900 : 2000) + typedYear : typedYear
        return DateFieldLogic.date(year: year, month: month, day: day, calendar: calendar)
    }

    /// `Jul 24, 2026`, `July 24 2026`, `24 Jul 2026` (month names in any case, full or short).
    private static func spelled(_ text: String, calendar: Calendar) -> Date? {
        let words = text.split(separator: " ", omittingEmptySubsequences: false).map(trimmedWord)
        guard words.count == 3, isDigits(words[2], 4...4), let year = Int(words[2]) else { return nil }
        let monthFirst = month(named: words[0], calendar: calendar).map { ($0, words[1]) }
        let dayFirst = month(named: words[1], calendar: calendar).map { ($0, words[0]) }
        guard let (month, dayText) = monthFirst ?? dayFirst, isDigits(dayText, 1...2), let day = Int(dayText)
        else { return nil }
        return DateFieldLogic.date(year: year, month: month, day: day, calendar: calendar)
    }

    /// The month number for a full or short month name in `calendar`'s language, ignoring case.
    static func month(named name: Substring, calendar: Calendar) -> Int? {
        let lowered = name.lowercased()
        guard !lowered.isEmpty else { return nil }
        let names = [calendar.monthSymbols, calendar.shortMonthSymbols, calendar.standaloneMonthSymbols]
        for list in names {
            if let index = list.firstIndex(where: { trimmedWord(Substring($0)).lowercased() == lowered }) {
                return index + 1
            }
        }
        return nil
    }

    /// A word without the trailing comma or dot that dates are written with ("24,", "Jul.").
    private static func trimmedWord(_ word: Substring) -> Substring {
        var word = word
        while let last = word.last, last == "," || last == "." { word = word.dropLast() }
        return word
    }

    private static func isDigits(_ text: Substring, _ counts: ClosedRange<Int>) -> Bool {
        counts.contains(text.count) && text.allSatisfy(NumberGrouping.isDigit)
    }
}
