import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class WeekViewModel {
    private(set) var state = WeekState()

    private let sessions: any SessionRepository
    private let templates: any TemplateRepository
    private let edits: WeekPlanEdits
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
        templates: any TemplateRepository,
        plans: any WorkoutPlanRepository,
        router: any Navigating,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        units: any UnitPreference
    ) {
        self.sessions = sessions
        self.templates = templates
        self.router = router
        self.now = now
        let days = DayCalendar(calendar: calendar)
        self.days = days
        self.edits = WeekPlanEdits(sessions: sessions, plans: plans, templates: templates, units: units, days: days)
    }

    /// Observes every session in the strip's range and the templates; started by the Screen's `.task` (SCR-4).
    func run() async {
        let layout = WeekLayout(days: days, today: days.day(of: now()))
        self.layout = layout
        if selected == nil { selected = layout.today }
        render()
        await withDiscardingTaskGroup { group in
            group.addTask { await self.observeSessions(layout.stripRange) }
            group.addTask { await self.observeTemplates() }
        }
    }

    private func observeSessions(_ range: ClosedRange<LocalDay>) async {
        for await details in sessions.observeSessions(from: range.lowerBound, through: range.upperBound) {
            summaries = .loaded(details.map { SessionSummary(detail: $0) })
            render()
        }
    }

    private func observeTemplates() async {
        for await list in templates.observeTemplates() {
            state.templates = list.map { WeekTemplateChoice(id: $0.id, name: $0.name) }
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
        case .destinationDismissed:
            state.destination = nil
        default:
            return sendPlanning(action)
        }
        return nil
    }

    /// The pickers of Add workout and Change workout, and the planning writes with their Undo (`WeekPlanEdits`).
    private func sendPlanning(_ action: WeekAction) -> Task<Void, Never>? {
        switch action {
        case .addWorkoutTapped(let day):
            state.destination = (day ?? selected).map { .add(WeekAddDay(id: $0, dayTitle: days.longTitle(of: $0))) }
        case .changeWorkoutTapped(let id):
            state.destination = sessionRef(id).map { .change($0) }
        case .undoTapped(let undo):
            return undoChange(undo)
        default:
            state.destination = nil
            let weekStart = layout?.weekStart(offset: state.weekOffset)
            let write = WeekPlanEdits.write(
                for: action,
                templates: state.templates,
                weekStart: weekStart,
                router: router
            )
            return write.flatMap { perform($0.key, $0.body) }
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
        let week = layout.week(offset: state.weekOffset)
        state.canPlanNextWeek = all.contains { week.contains($0.day) && $0.templateID != nil }
    }

    // MARK: - Lift sheet

    private func summary(_ id: UUID) -> SessionSummary? {
        guard case .loaded(let all) = summaries else { return nil }
        return all.first { $0.id == id }
    }

    /// The lift sheet's subject; nil for a done or unknown session, which cannot be rescheduled.
    private func sessionRef(_ id: UUID) -> WeekSessionRef? {
        guard let summary = summary(id), !summary.isDone else { return nil }
        return WeekSessionRef(
            id: id,
            title: summary.title,
            dayTitle: days.longTitle(of: summary.day),
            templateID: summary.templateID,
            canChangeWorkout: state.templates.contains { $0.id != summary.templateID }
        )
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
                showToast(message, undo: .reschedule(undo))
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

    /// Runs one planning write; a notice it returns becomes the toast. `key` is the session it changes, if any, so a
    /// double tap writes once (SCR-5).
    private func perform(_ key: UUID?, _ body: @escaping (WeekPlanEdits) async throws -> WeekNotice?)
        -> Task<Void, Never>?
    {
        let key = key ?? WeekPlanWrite.planKey
        guard !pending.contains(key) else { return nil }
        pending.insert(key)
        let edits = edits
        return Task {
            defer { pending.remove(key) }
            do {
                if let notice = try await body(edits) { showToast(notice.message, undo: notice.undo) }
            } catch {
                showToast(String(localized: "The workout could not be changed"), undo: nil)
            }
        }
    }

    private func showToast(_ message: String, undo: WeekUndo?) {
        toastCount += 1
        state.toast = WeekToast(id: toastCount, message: message, undo: undo)
    }
}
