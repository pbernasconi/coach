import Foundation
import LiftCore
import LiftStore

/// Everything the Week screen renders. Exclusive states are enums (SCR-6).
nonisolated struct WeekState: Equatable, Sendable {
    /// The weeks the strip pages through, as offsets from this week (0 = this week).
    static let weeks: ClosedRange<Int> = -4...4

    /// The calendar strip; nil until `run()` has read the clock.
    var strip: WeekStrip?
    /// The visible strip page.
    var weekOffset = 0
    /// Whether the top shows the week strip or the month calendar (the header's calendar button).
    var calendar: CalendarMode = .week
    /// The visible week's seven days, Monday first, each with its plan items and sessions (none on a free day).
    var sessions: Loadable<[WeekDaySection]> = .loading
    /// The open lift sheet or day picker, if any.
    var destination: Destination?
    /// The latest result of a lift sheet action, shown as a toast; a new value replaces the old one.
    var toast: WeekToast?
    /// The templates a day can be planned from, by list order.
    var templates: [WeekTemplateChoice] = []
    /// The visible week's coach plan line; nil when sync is off or the week's plan is not kept.
    var plan: WeekPlanHeader?

    enum CalendarMode: Equatable, Sendable {
        case week
        case month
    }

    enum Destination: Equatable, Sendable {
        /// The lift sheet for a planned session.
        case options(WeekSessionRef)
        /// The day picker for moving a planned session.
        case move(WeekMove)
        /// The template picker for adding a workout to a day.
        case add(WeekAddDay)
        /// The template picker for changing a planned session's workout.
        case change(WeekSessionRef)
    }

    /// The session the lift sheet is open for.
    var optionsTarget: WeekSessionRef? {
        guard case .options(let session) = destination else { return nil }
        return session
    }

    /// The day the add-workout picker is open for.
    var addTarget: WeekAddDay? {
        guard case .add(let day) = destination else { return nil }
        return day
    }

    /// The session the change-workout picker is open for.
    var changeTarget: WeekSessionRef? {
        guard case .change(let session) = destination else { return nil }
        return session
    }

    /// The session the day picker is open for.
    var moveTarget: WeekMove? {
        guard case .move(let move) = destination else { return nil }
        return move
    }
}

/// The calendar strip at the top of the Week screen.
nonisolated struct WeekStrip: Equatable, Sendable {
    var today: Date
    var selected: Date
    /// Days in the strip's range that have sessions.
    var days: [WeekDay]
    /// The first and last days the strip and the month calendar can show.
    var range: ClosedRange<Date>? = nil
}

/// A day with sessions, as the strip marks it.
nonisolated struct WeekDay: Equatable, Sendable {
    enum Status: Equatable, Sendable {
        /// At least one session still has planned sets.
        case planned
        /// Every session that day is done.
        case done
    }

    var date: Date
    var status: Status
    /// Each workout that day, in list order: its sport (the dot's colour) and whether it is done (a filled dot).
    var workouts: [WeekDayWorkout] = []
}

/// One workout's dot in the strip and the month calendar.
nonisolated struct WeekDayWorkout: Equatable, Sendable {
    var sport: Sport
    var isDone: Bool
}

/// One day of the visible week in the list: its plan items and Lift sessions. A day with no rows is a free day.
nonisolated struct WeekDaySection: Equatable, Sendable, Identifiable {
    let id: LocalDay
    /// "Monday, 2 March", or "Today · Monday, 2 March": what VoiceOver reads for the date badge.
    let title: String
    /// "Mon", the badge's top line.
    let weekday: String
    /// "2", the badge's number.
    let dayNumber: String
    let isToday: Bool
    let isSelected: Bool
    /// Plan items and sessions in the order they show.
    let entries: [WeekEntry]

    /// The day's Lift sessions, wherever they show among the items.
    var sessions: [SessionSummary] { entries.compactMap(\.session) }
}

/// A planned session named in the lift sheet.
nonisolated struct WeekSessionRef: Equatable, Sendable, Identifiable {
    let id: UUID
    let title: String
    /// The session's day, as the sheet's message shows it.
    let dayTitle: String
    /// The template the session was planned from, if any.
    var templateID: UUID?
    /// "Change workout" shows when there is a template to change to.
    var canChangeWorkout = false
}

/// The day picker for one session: where it is now and the days it can move to.
nonisolated struct WeekMove: Equatable, Sendable, Identifiable {
    /// The session id.
    let id: UUID
    let title: String
    /// The session's current day, as the sheet's subtitle shows it.
    let dayTitle: String
    let current: Date
    /// The first and last days the strip shows; a move stays inside them so the session stays visible.
    let first: Date
    let last: Date
}

/// A lift sheet result: a plain message and, when the change can be reverted, what `undo` needs.
nonisolated struct WeekToast: Equatable, Sendable, Identifiable {
    /// Counts up, so the same message twice is still a new toast.
    let id: Int
    let message: String
    let undo: WeekUndo?
}

/// What Undo on a Week toast puts back.
nonisolated enum WeekUndo: Equatable, Sendable {
    case reschedule(RescheduleUndo)
    case template(TemplateChangeUndo)
    /// A coach plan item moved by a drop: its id and the day it came from.
    case planMove(id: String, from: LocalDay)
}

/// A template in the add and change pickers.
nonisolated struct WeekTemplateChoice: Equatable, Sendable, Identifiable {
    let id: UUID
    let name: String
}

/// The day the add-workout picker plans for.
nonisolated struct WeekAddDay: Equatable, Sendable, Identifiable {
    let id: LocalDay
    /// "Thursday, 5 March", as the sheet's message shows it.
    let dayTitle: String
}
