import Foundation
import LiftCore
import LiftSync

/// One row of a Week day: a Lift session (its progress; a tap opens the workout) or a coach plan item (a tap opens
/// its detail sheet).
nonisolated enum WeekEntry: Equatable, Sendable, Identifiable {
    case session(SessionSummary)
    case plan(WeekPlanItem)

    var id: String {
        switch self {
        case .session(let session): "session-\(session.id.uuidString)"
        case .plan(let item): "plan-\(item.id)"
        }
    }

    var session: SessionSummary? {
        guard case .session(let session) = self else { return nil }
        return session
    }

    /// Done: a finished session, or an item the server says is done. Skipped and missed are not done.
    var isDone: Bool {
        switch self {
        case .session(let session): session.isDone
        case .plan(let item): item.state == .done
        }
    }

    /// A planned rest day is an item, but it marks nothing in the strip.
    var isRest: Bool {
        guard case .plan(let item) = self else { return false }
        return item.sport == .rest
    }
}

/// A coach plan item as the Week list and its detail sheet show it. Every text comes from the server as is.
nonisolated struct WeekPlanItem: Equatable, Sendable, Identifiable {
    let id: String
    let sport: Sport
    let title: String
    /// "13:30 · 60 min · 45 TSS".
    let subtitle: String
    let state: CoachItemState
    /// "Today", "Done"…
    let stateLabel: String
    let isAdapted: Bool
    let why: String?
    let notes: String?
    let keyTargets: [String]
    let steps: [CoachStep]
    /// The matched activity against the plan, "62 min · 70 TSS / 60 min · 45 TSS"; nil until done.
    let doneText: String?
    /// "Tuesday, 20 October": the sheet's subtitle.
    let dayTitle: String

    init(_ item: CoachItem, dayTitle: String) {
        id = item.id
        sport = Sport(rawValue: item.sport) ?? .other
        title = item.title
        subtitle = item.subtitle
        state = item.state
        stateLabel = item.stateLabel
        isAdapted = item.adapted
        why = item.why.flatMap { $0.isEmpty ? nil : $0 }
        notes = item.notes.flatMap { $0.isEmpty ? nil : $0 }
        keyTargets = item.keyTargets
        steps = item.steps
        doneText = item.done?.text.flatMap { $0.isEmpty ? nil : $0 }
        self.dayTitle = dayTitle
    }

    /// The row's second line: the subtitle, with "Adapted" when the coach changed the item.
    var rowSubtitle: String? {
        guard isAdapted else { return subtitle.isEmpty ? nil : subtitle }
        let adapted = String(localized: "Adapted")
        return subtitle.isEmpty ? adapted : "\(subtitle) · \(adapted)"
    }
}

/// The visible week's plan line above the days: its title, the server's totals and when it was fetched.
nonisolated struct WeekPlanHeader: Equatable, Sendable {
    /// "Build week 3", or nil when the plan has none.
    let title: String?
    /// "2/9 done · 2:10 of 9:00 · 140 of 520 TSS".
    let totals: String
    /// "Updated 1:05 PM", or "Offline · updated 1:05 PM".
    let freshness: String?
    let isOffline: Bool
}
