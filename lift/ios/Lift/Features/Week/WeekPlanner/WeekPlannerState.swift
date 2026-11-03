import Foundation

/// Everything the planning screen renders (lift/APP-API.md, "Weekly planning"). Exclusive states are enums (SCR-6).
nonisolated struct WeekPlannerState: Equatable, Sendable {
    /// The week from the coach: the draft, the calendar, last week and the shape.
    var week = AppResourceState<PlannerWeek>()
    var tab: Tab = .week
    /// The Last week and Shape answers; filled from the open draft's answers once it loads.
    var answers = PlannerAnswers()
    /// The "Tell Coach what to change" box.
    var note = ""
    var write: Write = .idle
    var destination: Destination?
    /// Set once the week is accepted: the screen closes and the Week tab shows this line.
    var acceptedNote: String?

    enum Tab: String, CaseIterable, Sendable {
        case week, lastWeek, shape
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
        /// The Accept summary.
        case accept
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

    /// The week whose Accept summary is open.
    var acceptWeek: PlannerWeek? { destination == .accept ? loaded : nil }

    var failureText: String? {
        guard case .failed(let text) = write else { return nil }
        return text
    }
}
