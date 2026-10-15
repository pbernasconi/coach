import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class WeekViewModel {
    private(set) var state = WeekState()

    private let sessions: any SessionRepository
    private let router: any Navigating
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    @ObservationIgnored private var layout: WeekLayout?
    @ObservationIgnored private var selected: LocalDay?
    /// Every session in the strip's range; `.loading` until the first value arrives.
    @ObservationIgnored private var summaries: Loadable<[SessionSummary]> = .loading
    /// Sessions with a lift sheet write in flight, so a double tap cannot write twice (SCR-5).
    @ObservationIgnored private var pending: Set<UUID> = []
    @ObservationIgnored private var toastCount = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessions: any SessionRepository,
        router: any Navigating,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.sessions = sessions
        self.router = router
        self.now = now
        self.days = DayCalendar(calendar: calendar)
    }

    /// Observes every session in the strip's range; started by the Screen's `.task` (SCR-4).
    func run() async {
        let layout = WeekLayout(days: days, today: days.day(of: now()))
        self.layout = layout
        if selected == nil { selected = layout.today }
        render()
        let range = layout.stripRange
        for await details in sessions.observeSessions(from: range.lowerBound, through: range.upperBound) {
            summaries = .loaded(details.map { SessionSummary(detail: $0) })
            render()
        }
    }

    @discardableResult
    func send(_ action: WeekAction) -> Task<Void, Never>? {
        switch action {
        case .daySelected(let date):
            select(days.day(of: date))
        case .weekChanged(let offset):
            changeWeek(to: offset)
        case .sessionTapped(let id):
            router.open(.workout(id))
        case .sessionOptionsTapped(let id):
            state.destination = sessionRef(id).map { .options($0) }
        case .moveTapped(let id):
            state.destination = move(id).map { .move($0) }
        case .moveDayPicked(let id, let date):
            return moveDayPicked(id, to: days.day(of: date))
        case .pushToNextWeekTapped(let id):
            return reschedule(id, .pushToNextWeek, message: String(localized: "Pushed to next week"))
        case .removeTapped(let id):
            let title = summary(id)?.title ?? ""
            return reschedule(id, .remove, message: String(localized: "Removed \(title)"))
        case .undoTapped(let undo):
            return undoChange(undo)
        case .destinationDismissed:
            state.destination = nil
        }
        return nil
    }

    // MARK: - Selection

    private func select(_ day: LocalDay) {
        selected = day
        if let layout { state.weekOffset = layout.offset(of: day) }
        render()
    }

    private func changeWeek(to offset: Int) {
        state.weekOffset = offset
        guard let layout else { return }
        if let selected, layout.week(offset: offset).contains(selected) { return }
        selected = layout.defaultSelection(offset: offset)
        render()
    }

    private func render() {
        guard let layout, let selected, let todayDate = days.date(of: layout.today),
            let selectedDate = days.date(of: selected)
        else { return }
        guard case .loaded(let all) = summaries else {
            state.strip = WeekStrip(today: todayDate, selected: selectedDate, days: [])
            return
        }
        state.strip = WeekStrip(today: todayDate, selected: selectedDate, days: layout.markedDays(all))
        state.sessions = layout.sections(all, offset: state.weekOffset, selected: selected)
    }

    // MARK: - Lift sheet

    private func summary(_ id: UUID) -> SessionSummary? {
        guard case .loaded(let all) = summaries else { return nil }
        return all.first { $0.id == id }
    }

    /// The lift sheet's subject; nil for a done or unknown session, which cannot be rescheduled.
    private func sessionRef(_ id: UUID) -> WeekSessionRef? {
        guard let summary = summary(id), !summary.isDone else { return nil }
        return WeekSessionRef(id: id, title: summary.title, dayTitle: days.longTitle(of: summary.day))
    }

    private func move(_ id: UUID) -> WeekMove? {
        guard let ref = sessionRef(id), let summary = summary(id), let layout,
            let current = days.date(of: summary.day),
            let first = days.date(of: layout.stripRange.lowerBound),
            let last = days.date(of: layout.stripRange.upperBound)
        else { return nil }
        return WeekMove(id: id, title: ref.title, dayTitle: ref.dayTitle, current: current, first: first, last: last)
    }

    private func moveDayPicked(_ id: UUID, to day: LocalDay) -> Task<Void, Never>? {
        state.destination = nil
        guard let summary = summary(id), summary.day != day else { return nil }
        let message = String(localized: "Moved to \(days.shortTitle(of: day))")
        return reschedule(id, .move(to: day), message: message)
    }

    /// Applies the change at once and offers Undo in a toast; never asks first (product rule).
    private func reschedule(_ id: UUID, _ action: RescheduleAction, message: String) -> Task<Void, Never>? {
        guard !pending.contains(id) else { return nil }
        pending.insert(id)
        return Task {
            defer { pending.remove(id) }
            do {
                let undo = try await sessions.reschedule(id, action)
                showToast(message, undo: undo)
            } catch {
                showToast(String(localized: "The workout could not be changed"), undo: nil)
            }
        }
    }

    private func undoChange(_ undo: RescheduleUndo) -> Task<Void, Never>? {
        guard !pending.contains(undo.sessionID) else { return nil }
        pending.insert(undo.sessionID)
        return Task {
            defer { pending.remove(undo.sessionID) }
            do {
                try await sessions.undo(undo)
            } catch {
                showToast(String(localized: "The change could not be undone"), undo: nil)
            }
        }
    }

    private func showToast(_ message: String, undo: RescheduleUndo?) {
        toastCount += 1
        state.toast = WeekToast(id: toastCount, message: message, undo: undo)
    }
}
