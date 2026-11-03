import Foundation

/// The planning screen's week as the coach sends it (lift/APP-API.md, "Weekly planning"): every label ready to show.
nonisolated struct PlannerWeek: Decodable, Equatable, Sendable, Identifiable {
    /// Where the week's draft is: none yet, Coach drafting, a draft to review, or a failed draft.
    enum DraftState: String, Decodable, Sendable {
        case none, drafting, proposed, failed
    }

    let weekStart: String
    let titleText: String
    let weekText: String
    let state: DraftState
    let proposalId: String?
    let version: Int?
    let errorText: String?
    let totalsText: String?
    let checks: Checks?
    let days: [Day]
    let change: Change?
    let review: Review?
    let summary: String?
    let issues: [Issue]
    let quickAsks: [String]
    let lastWeek: LastWeek?
    let facts: [Fact]
    let feels: [Choice]
    let suggested: Suggested
    let answers: PlannerAnswers?
    let longDays: [LongDay]
    let planningAround: [String]
    let syncsTo: [String]
    /// Step 5: the draft against last week, and the sessions to keep if the week goes sideways (empty before a draft).
    let versusTitle: String
    let versus: [Versus]
    let keepers: [Keeper]
    /// Accept's line ("On your calendar now…"), only in the answer to an accept.
    var note: String?
    /// Why the coach did not make a change ("Coach is already drafting this week."), only in the answer to a write.
    var refusedText: String?

    static let path = "api/app/plan/week"

    var id: String { weekStart }

    var sessions: [Session] { days.flatMap(\.sessions) }

    func session(_ index: Int) -> Session? { sessions.first { $0.index == index } }

    struct Checks: Decodable, Equatable, Sendable {
        let tone: String
        let text: String
    }

    struct Day: Decodable, Equatable, Sendable, Identifiable {
        let date: String
        let labelText: String
        /// A day already gone this week: kept as it was.
        let past: Bool
        /// Step 2's line: its free windows on the calendar ("Free 6:00–9:30, 10:00–21:00").
        let freeText: String
        let off: Bool
        let totalText: String?
        let sessions: [Session]
        let calendar: [CalendarEvent]
        var id: String { date }
    }

    struct Session: Decodable, Equatable, Sendable, Identifiable {
        let index: Int
        let title: String
        let sport: String
        let minutes: Int?
        let timeText: String
        let lengthText: String?
        let tssText: String?
        let hard: Bool
        let why: String?
        let description: String?
        let changed: Bool
        let slots: [Slot]
        var id: Int { index }

        /// The sport for colour and icon; physio and stretching read as mobility (pink), as on the web.
        var sportKind: Sport {
            if title.range(of: "physio|stretch|mobility", options: [.regularExpression, .caseInsensitive]) != nil {
                return .yoga
            }
            return Sport(rawValue: sport) ?? .other
        }
    }

    struct Slot: Decodable, Equatable, Sendable, Identifiable {
        let date: String
        let time: String
        let text: String
        var id: String { "\(date) \(time)" }
    }

    struct CalendarEvent: Decodable, Equatable, Sendable {
        let title: String
        let allDay: Bool
        let timeText: String
    }

    struct Change: Decodable, Equatable, Sendable {
        let note: String?
        let changed: [Line]
        let gaveUp: String?

        struct Line: Decodable, Equatable, Sendable {
            let what: String
            let how: String
        }
    }

    struct Review: Decodable, Equatable, Sendable {
        let headline: String?
        let reasoning: [String]
        let decisions: [Decision]
        let watch: [String]

        struct Decision: Decodable, Equatable, Sendable {
            let title: String
            let why: String?
            let tradeoff: String?
        }
    }

    struct Issue: Decodable, Equatable, Sendable {
        let level: String
        let message: String
    }

    struct LastWeek: Decodable, Equatable, Sendable {
        /// "How last week went", or "This week so far" while that week is still going.
        let titleText: String
        /// Coach's read: the gym, the hard sessions and the volume, each with a tone.
        let read: [Read]
        let timeText: String
        let timeNote: String?
        let liftsText: String
        let liftsShort: Bool
        let hardText: String
        let hardShort: Bool
        let days: [Day]

        struct Day: Decodable, Equatable, Sendable, Identifiable {
            let date: String
            let letter: String
            let labelText: String
            let title: String?
            let tone: String
            /// What Strava recorded, one line per activity, and what was missed.
            let doneText: String?
            let missedText: String?
            var id: String { date }
        }

        struct Read: Decodable, Equatable, Sendable {
            let title: String
            let text: String
            let tone: String
        }
    }

    struct Fact: Decodable, Equatable, Sendable, Identifiable {
        let id: String
        let label: String
        let value: String
    }

    struct Choice: Decodable, Equatable, Sendable, Identifiable {
        let id: String
        let label: String
    }

    struct Suggested: Decodable, Equatable, Sendable {
        let feelText: String?
        let hours: Int?
        let hoursText: String?
    }

    struct LongDay: Decodable, Equatable, Sendable, Identifiable {
        let date: String
        let text: String
        var id: String { date }
    }
}

/// The Last week and Shape answers Coach drafts with; nil leaves it to Coach.
nonisolated struct PlannerAnswers: Codable, Equatable, Sendable {
    var feel: String?
    var hours: Int?
    var gym: Int?
    var hard: Int?
    var longDay: String?
    var daysOff: [String] = []
    /// Travel days: no gym, so Coach plans runs or rest there.
    var away: [String] = []
    var lock: String = ""
}
