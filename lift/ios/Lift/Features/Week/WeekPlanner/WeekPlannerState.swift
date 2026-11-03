import Foundation

/// Everything the planning screen renders (lift/APP-API.md, "Weekly planning"). Exclusive states are enums (SCR-6).
nonisolated struct WeekPlannerState: Equatable, Sendable {
    /// The week from the coach: the draft, the calendar, last week and the shape.
    var week = AppResourceState<PlannerWeek>()
    /// Where Paolo is in the five steps; an open draft starts on Draft.
    var step: Step = .lastWeek
    /// The answers of steps 1 to 3; filled from the open draft's answers once it loads.
    var answers = PlannerAnswers()
    /// The "Tell Coach what to change" box.
    var note = ""
    var write: Write = .idle
    var destination: Destination?
    /// Set once the week is accepted: the screen closes and the Week tab shows this line.
    var acceptedNote: String?

    /// The planning steps, in order: how last week went, the days (free, off, away), the priorities, Coach's draft,
    /// and the review that accepts it.
    enum Step: Int, CaseIterable, Sendable {
        case lastWeek, days, shape, draft, review

        var title: LocalizedStringResource {
            switch self {
            case .lastWeek: "Last week"
            case .days: "Your week"
            case .shape: "Priorities"
            case .draft: "Draft"
            case .review: "Review"
            }
        }

        var next: Step? { Step(rawValue: rawValue + 1) }
        var previous: Step? { Step(rawValue: rawValue - 1) }
    }

    /// A change on its way to the coach, or why the last one did not happen.
    enum Write: Equatable, Sendable {
        case idle
        case working
        case failed(String)
    }

    enum Destination: Equatable, Sendable {
        /// One session's sheet: why, move, length, remove, swap.
        case session(Int)
    }

    var loaded: PlannerWeek? { week.content.value }
    var isProposed: Bool { loaded?.state == .proposed }
    var isDrafting: Bool { loaded?.state == .drafting }
    var isWorking: Bool { write == .working }

    /// The session whose sheet is open.
    var openSession: PlannerWeek.Session? {
        guard case .session(let index) = destination else { return nil }
        return loaded?.session(index)
    }

    /// Review needs a draft; the steps before it are always open.
    func isOpen(_ step: Step) -> Bool {
        switch step {
        case .lastWeek, .days, .shape: true
        case .draft: loaded.map { $0.state != .none } ?? false
        case .review: isProposed
        }
    }

    var failureText: String? {
        guard case .failed(let text) = write else { return nil }
        return text
    }
}
