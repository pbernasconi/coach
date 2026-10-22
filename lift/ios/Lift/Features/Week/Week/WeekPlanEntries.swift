import Foundation
import KoboComponents
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

    /// The sport of the row: strength for a Lift session.
    var sport: Sport {
        switch self {
        case .session: .strength
        case .plan(let item): item.sport
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
    /// A completed activity that no planned workout matched; a tap opens it.
    let isUnplanned: Bool
    let why: String?
    let notes: String?
    let keyTargets: [String]
    let steps: [CoachStep]
    /// Time, distance and TSS as text, each nil when unknown.
    let stats: CoachStats
    /// `good | partial | off` for a done item, else nil: the colour of the card's edge.
    let compliance: String?
    /// The interval bars under the row; empty without structured steps.
    let profile: [ProfileSegment]
    /// The matched activity against the plan, "62 min · 70 TSS / 60 min · 45 TSS"; nil until done.
    let doneText: String?
    /// The Strava activity that completed the item, to open on Training.
    let doneActivityId: String?
    /// The Lift session the item plans (lower case), for its read-only session page.
    let liftSessionId: String?
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
        isUnplanned = item.unplanned
        why = item.why.flatMap { $0.isEmpty ? nil : $0 }
        notes = item.notes.flatMap { $0.isEmpty ? nil : $0 }
        keyTargets = item.keyTargets
        steps = item.steps
        stats = item.stats
        compliance = item.compliance
        profile = item.profile.enumerated().map { index, bar in
            // "Z1"…"Z5" to the strip's levels 0…4, calm to hot.
            let level = Int(bar.zone.dropFirst()).map { $0 - 1 } ?? 0
            return ProfileSegment(id: index, width: bar.seconds, start: bar.from, end: bar.to, level: level)
        }
        doneText = item.done?.text.flatMap { $0.isEmpty ? nil : $0 }
        doneActivityId = item.done?.activityId
        liftSessionId = item.liftSessionId
        self.dayTitle = dayTitle
    }

    /// The card's status as the web plan colours it: missed and skipped are one "not done".
    var cardStatus: WeekCardStatus {
        switch state {
        case .done: compliance == "partial" || compliance == "off" ? .partlyDone : .done
        case .missed, .skipped: .notDone
        case .planned, .today: .planned
        }
    }

    /// Whether the card shows a distance: not for strength, yoga or rest, which have none.
    var hasDistance: Bool { ![.strength, .yoga, .rest].contains(sport) }

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

/// Where a tap on a Week row goes (lift/APP-API.md, "Links"). A plan item that names a Lift session opens the coach's
/// session page; any other item its detail sheet. A Lift session opens its workout, or, once finished and the coach is
/// connected, the coach's read-only session page.
nonisolated enum WeekLinks {
    static func session(_ summary: SessionSummary?, id: UUID, coachIsOn: Bool) -> AppRoute {
        guard coachIsOn, summary?.isDone == true else { return .workout(id) }
        return .liftSession(id.uuidString.lowercased())
    }

    static func planItem(_ item: WeekPlanItem) -> AppRoute? {
        if let id = item.liftSessionId { return LiftLinks.session(id) }
        if item.isUnplanned, let id = item.doneActivityId { return .activity(id) }
        // A rest day has nothing to show beyond its row.
        return item.sport == .rest ? nil : .plannedWorkout(item.id)
    }
}
