import Foundation

extension PlannerWeek {
    /// One week the planner can open.
    nonisolated struct WeekChoice: Decodable, Equatable, Sendable, Identifiable {
        let weekStart: String
        let labelText: String
        let datesText: String
        var id: String { weekStart }

        /// "Next week · Nov 9–15", or the dates alone for a week further ahead.
        var menuText: String { labelText == datesText ? datesText : "\(labelText) · \(datesText)" }
    }

    /// One row of "Against last week": Time, Lifts, Hard sessions, Running.
    nonisolated struct Versus: Decodable, Equatable, Sendable {
        let label: String
        let beforeText: String
        let afterText: String
    }

    /// A session to keep if the week goes sideways: the first lift, the first hard session, the longest run or ride.
    nonisolated struct Keeper: Decodable, Equatable, Sendable, Identifiable {
        let index: Int
        let title: String
        let sport: String
        let dayText: String
        var id: Int { index }

        var sportKind: Sport { Sport(rawValue: sport) ?? .other }
    }
}

nonisolated extension PlannerAnswers {
    /// What a day is for: free, busy (one short session), travelling (no gym), rest or sick (no training). Rest is
    /// `daysOff` and travelling `away` on the coach.
    nonisolated enum DayMode: String, CaseIterable, Identifiable, Sendable {
        case free, busy, travel, rest, sick

        var id: Self { self }
    }

    func mode(of date: String) -> DayMode {
        if sick.contains(date) { return .sick }
        if daysOff.contains(date) { return .rest }
        if away.contains(date) { return .travel }
        if busy.contains(date) { return .busy }
        return .free
    }

    /// The answers with `date` set to `mode`: a day is in at most one list.
    func with(_ date: String, as mode: DayMode) -> Self {
        var copy = self
        for list in [\Self.daysOff, \Self.away, \Self.busy, \Self.sick] {
            copy[keyPath: list].removeAll { $0 == date }
        }
        let list: WritableKeyPath<Self, [String]>? =
            switch mode {
            case .free: nil
            case .busy: \.busy
            case .travel: \.away
            case .rest: \.daysOff
            case .sick: \.sick
            }
        if let list { copy[keyPath: list] = (copy[keyPath: list] + [date]).sorted() }
        return copy
    }

    /// The answers with Paolo's note for `date` (200 characters at most); an empty note is dropped.
    func with(_ date: String, note: String) -> Self {
        var copy = self
        copy.notes[date] = note.trimmingCharacters(in: .whitespaces).isEmpty ? nil : String(note.prefix(200))
        return copy
    }
}
