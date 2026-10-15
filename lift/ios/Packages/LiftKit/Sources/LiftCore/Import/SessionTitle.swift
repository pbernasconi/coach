import Foundation

/// A session title line such as `Workout C- sept 29` or `Workout lift - July 7`.
struct SessionTitle: Equatable {
    let title: String
    let month: Int
    let day: Int
    let year: Int?

    /// Words one of which must appear in the title part, so an exercise line ending in a date is not a title.
    private static let keywords = [
        "workout", "lift", "session", "training", "gym", "strength", "upper", "lower", "push", "pull", "legs",
        "full body",
    ]
    private static let months = [
        "january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
        "november", "december",
    ]

    static func parse(_ line: String) -> SessionTitle? {
        let pattern =
            /(?<title>.*?)[\s\-–—:,]*\b(?<month>[A-Za-z]{3,9})\.?\s+(?<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?<year>\d{4}))?/
        guard let match = line.wholeMatch(of: pattern.ignoresCase()),
            let month = monthNumber(String(match.output.month)),
            let day = Int(match.output.day), (1...31).contains(day)
        else { return nil }
        let title = String(match.output.title).trimmingCharacters(in: CharacterSet(charactersIn: " -–—:,"))
        let lowered = title.lowercased()
        guard title.isEmpty || keywords.contains(where: lowered.contains) else { return nil }
        return SessionTitle(
            title: title.isEmpty ? "Workout" : title,
            month: month,
            day: day,
            year: match.output.year.flatMap { Int($0) }
        )
    }

    /// The day this title names. Without a year: the most recent such date on or before `reference`.
    func resolve(reference: Date, calendar: Calendar) -> LocalDay? {
        if let year {
            let day = LocalDay(year: year, month: month, day: day)
            return day.startDate(in: calendar) == nil ? nil : day
        }
        let today = LocalDay(reference, calendar: calendar)
        for year in stride(from: today.year, through: today.year - 8, by: -1) {
            let candidate = LocalDay(year: year, month: month, day: day)
            if candidate <= today, candidate.startDate(in: calendar) != nil { return candidate }
        }
        return nil
    }

    private static func monthNumber(_ word: String) -> Int? {
        let word = word.lowercased()
        return months.firstIndex { $0.hasPrefix(word) }.map { $0 + 1 }
    }
}
