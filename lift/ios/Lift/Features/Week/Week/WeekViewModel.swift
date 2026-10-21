import Foundation
import LiftCore
import LiftStore
import LiftSync
import Observation

@Observable
final class WeekViewModel {
    private(set) var state = WeekState()

    private let sessions: any SessionRepository
    private let templates: any TemplateRepository
    private let edits: WeekPlanEdits
    private let router: any Navigating
    private let coachPlan: any CoachPlanProviding
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    @ObservationIgnored private var layout: WeekLayout?
    @ObservationIgnored private var selected: LocalDay?
    /// Every session in the strip's range; `.loading` until the first value arrives.
    @ObservationIgnored private var summaries: Loadable<[SessionSummary]> = .loading
    /// The coach plan; `.off` until its first value, and for good when sync is off.
    @ObservationIgnored private var plan = CoachPlanSnapshot.off
    @ObservationIgnored private var merge: WeekPlanMerge?
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
        units: any UnitPreference,
        coachPlan: any CoachPlanProviding
    ) {
        self.sessions = sessions
        self.coachPlan = coachPlan
        self.templates = templates
        self.router = router
        self.now = now
        let days = DayCalendar(calendar: calendar)
        self.days = days
        self.edits = WeekPlanEdits(sessions: sessions, plans: plans, templates: templates, units: units, days: days)
    }

    /// Observes the strip's sessions, the templates and the coach plan; started by the Screen's `.task` (SCR-4).
    func run() async {
        let layout = WeekLayout(days: days, today: days.day(of: now()))
        self.layout = layout
        if selected == nil { selected = layout.today }
        render()
        let start = layout.weekStart(offset: state.weekOffset)
        await withDiscardingTaskGroup { group in
            group.addTask { await self.observeSessions(layout.stripRange) }
            group.addTask { await self.observeTemplates() }
            group.addTask { await self.observePlan() }
            group.addTask { await self.showPlan(start) }
        }
    }

    private func showPlan(_ start: LocalDay) async { await coachPlan.show(weekStart: start) }

    private func observePlan() async {
        for await snapshot in coachPlan.snapshots() {
            plan = snapshot
            render()
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
            return select(days.day(of: date))
        case .dayTapped(let day):
            return select(day)
        case .weekChanged(let offset):
            return changeWeek(to: offset)
        case .sessionTapped(let id):
            router.open(WeekLinks.session(summary(id), id: id, coachIsOn: plan.status != .off))
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
        case .planItemTapped(let id):
            state.destination = merge?.item(id).map { .planItem($0) }
        case .refreshPulled:
            let coachPlan = coachPlan
            return Task { await coachPlan.refresh() }
        default:
            return sendPlanning(action)
        }
        return nil
    }

    /// The pickers, the planning writes with their Undo (`WeekPlanEdits`), and the coach plan's links and refresh.
    private func sendPlanning(_ action: WeekAction) -> Task<Void, Never>? {
        switch action {
        case .addWorkoutTapped(let day):
            state.destination = (day ?? selected).map { .add(WeekAddDay(id: $0, dayTitle: days.longTitle(of: $0))) }
        case .changeWorkoutTapped(let id):
            state.destination = sessionRef(id).map { .change($0) }
        case .undoTapped(let undo):
            return undoChange(undo)
        case .planItemTapped(let id):
            guard let item = merge?.item(id) else { return nil }
            if let route = WeekLinks.planItem(item) { router.open(route) } else { state.destination = .planItem(item) }
        case .planActivityTapped(let id):
            state.destination = nil
            router.open(.activity(id))
        case .refreshPulled:
            return Task { [coachPlan] in await coachPlan.refresh() }
        default:
            state.destination = nil
            let start = layout?.weekStart(offset: state.weekOffset)
            let write = WeekPlanEdits.write(for: action, templates: state.templates, weekStart: start, router: router)
            return write.flatMap { perform($0.key, $0.body) }
        }
        return nil
    }

    // MARK: - Selection

    private func select(_ day: LocalDay) -> Task<Void, Never>? {
        selected = day
        let shown = layout.flatMap { showWeek($0.offset(of: day)) }
        render()
        return shown
    }

    /// Sets the visible page and asks for its plan, which fetches it when it is not kept yet.
    private func showWeek(_ offset: Int) -> Task<Void, Never>? {
        guard offset != state.weekOffset else { return nil }
        state.weekOffset = offset
        guard let start = layout?.weekStart(offset: offset) else { return nil }
        let coachPlan = coachPlan
        return Task { await coachPlan.show(weekStart: start) }
    }

    private func changeWeek(to offset: Int) -> Task<Void, Never>? {
        let shown = showWeek(offset)
        guard let layout else { return shown }
        if let selected, layout.week(offset: offset).contains(selected) { return shown }
        selected = layout.defaultSelection(offset: offset)
        render()
        return shown
    }

    private func render() {
        guard let layout, let selected, let todayDate = days.date(of: layout.today),
            let selectedDate = days.date(of: selected)
        else { return }
        guard case .loaded(let all) = summaries else {
            state.strip = WeekStrip(today: todayDate, selected: selectedDate, days: [])
            return
        }
        let days = days
        let merge = WeekPlanMerge(summaries: all, book: plan.shownBook) { days.longTitle(of: $0) }
        self.merge = merge
        state.strip = WeekStrip(today: todayDate, selected: selectedDate, days: layout.markedDays(merge))
        state.sessions = .loaded(layout.sections(merge, offset: state.weekOffset, selected: selected))
        state.plan = layout.planHeader(plan, offset: state.weekOffset)
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
        summary(id).flatMap { layout?.sessionRef($0, templates: state.templates) }
    }

    private func move(_ id: UUID) -> WeekMove? {
        summary(id).flatMap { layout?.move($0, templates: state.templates) }
    }

    private func moveDayPicked(_ id: UUID, to day: LocalDay) -> Task<Void, Never>? {
        state.destination = nil
        guard let summary = summary(id), summary.day != day else { return nil }
        let message = String(localized: "Moved to \(days.shortTitle(of: day))")
        return reschedule(id, .move(to: day), message: message)
    }

    /// Applies the change at once and offers Undo in a toast; never asks first (product rule).
    private func reschedule(_ id: UUID, _ action: RescheduleAction, message: String) -> Task<Void, Never>? {
        perform(id) { WeekNotice(message, undo: .reschedule(try await $0.sessions.reschedule(id, action))) }
    }

    private func undoChange(_ undo: RescheduleUndo) -> Task<Void, Never>? {
        perform(undo.sessionID, failure: String(localized: "The change could not be undone")) {
            try await $0.undo(.reschedule(undo))
        }
    }

    /// Runs one write; a notice it returns becomes the toast, and a failure shows `failure`. `key` is the session it
    /// changes, if any, so a double tap writes once (SCR-5).
    private func perform(
        _ key: UUID?,
        failure: String = String(localized: "The workout could not be changed"),
        _ body: @escaping (WeekPlanEdits) async throws -> WeekNotice?
    ) -> Task<Void, Never>? {
        let key = key ?? WeekPlanWrite.planKey
        guard !pending.contains(key) else { return nil }
        pending.insert(key)
        let edits = edits
        return Task {
            defer { pending.remove(key) }
            do {
                if let notice = try await body(edits) { showToast(notice.message, undo: notice.undo) }
            } catch {
                showToast(failure, undo: nil)
            }
        }
    }

    private func showToast(_ message: String, undo: WeekUndo?) {
        toastCount += 1
        state.toast = WeekToast(id: toastCount, message: message, undo: undo)
    }
}
