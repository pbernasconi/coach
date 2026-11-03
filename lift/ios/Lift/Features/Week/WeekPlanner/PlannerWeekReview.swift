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

extension PlannerAnswers {
    /// What a day is for: free, off (no training) or away (travel: no gym).
    nonisolated enum DayMode: String, CaseIterable, Sendable {
        case free, off, away
    }

    func mode(of date: String) -> DayMode {
        if daysOff.contains(date) { return .off }
        if away.contains(date) { return .away }
        return .free
    }

    /// The answers with `date` set to `mode`: a day is in at most one of days off and away.
    func with(_ date: String, as mode: DayMode) -> Self {
        var copy = self
        copy.daysOff.removeAll { $0 == date }
        copy.away.removeAll { $0 == date }
        switch mode {
        case .off: copy.daysOff = (copy.daysOff + [date]).sorted()
        case .away: copy.away = (copy.away + [date]).sorted()
        case .free: break
        }
        return copy
    }
}
