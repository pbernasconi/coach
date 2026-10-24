import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import Observation

/// One workout's page, planned and done as one (lift/APP-API.md, "Workout"). It shows what the server sends.
@Observable
final class ActivityDetailViewModel {
    private(set) var state: ActivityDetailState

    private let resource: AppResource<WorkoutDetail>
    private let feedbackSaver: WorkoutFeedbackSaver
    /// Nil where a Lift session cannot be started (demo pages, previews).
    private let starter: PlannedSessionStarter?
    private let data: any AppDataSource
    private let coachPlan: any CoachPlanProviding
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let router: any Navigating
    private let tabs: any TabSwitching
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    /// - Parameter ref: the workout, `WorkoutDetail.planRef(_:)` or `WorkoutDetail.stravaRef(_:)`.
    init(
        ref: String,
        seed: ActivitySeed?,
        data: any AppDataSource,
        starter: PlannedSessionStarter?,
        coachPlan: any CoachPlanProviding,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.tabs = tabs
        self.state = ActivityDetailState(ref: ref, seed: seed)
        self.resource = AppResource(
            path: WorkoutDetail.path(ref),
            source: data,
            now: now,
            days: DayCalendar(calendar: calendar)
        )
        self.router = router
        self.feedbackSaver = WorkoutFeedbackSaver(data: data)
        self.starter = starter
        self.data = data
        self.coachPlan = coachPlan
        self.now = now
        self.calendar = calendar
    }

    /// Started by the Screen's `.task`; cancelled when the view goes away (SCR-4).
    func run() async {
        await load()
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: ActivityDetailAction) -> Task<Void, Never>? {
        switch action {
        case .retryTapped:
            state.workout.content = .loading
            return Task { await load() }
        case .refreshPulled:
            return Task { await load() }
        case .neighbourTapped(let id):
            router.back()
            router.open(.activity(id))
        case .activityTapped(let id):
            state.destination = nil
            router.open(.activity(id))
        case .axisChanged(let axis):
            state.axis = axis
        case .paceModeChanged(let mode):
            state.paceMode = mode
        case .panelTapped(let panel):
            state.destination = .panel(panel)
        case .destinationDismissed:
            state.destination = nil
        case .connectTapped:
            tabs.show(.settings)
        case .liftSessionTapped(let id):
            router.open(LiftLinks.session(id))
        case .feedback(let action):
            return saveFeedback(action)
        case .startWorkoutTapped:
            return startWorkout()
        case .doneToggled(let done):
            return setDone(done)
        case .moveTapped, .moveDayPicked, .deleteTapped, .deleteConfirmed:
            return sendPlanEdit(action)
        }
        return nil
    }

    /// The bar's "Move to another day" and "Delete workout", for a planned workout not done yet.
    private func sendPlanEdit(_ action: ActivityDetailAction) -> Task<Void, Never>? {
        let days = DayCalendar(calendar: calendar)
        switch action {
        case .moveTapped:
            state.destination = moveDay(days).map { .moveDay($0) }
        case .moveDayPicked(let date):
            state.destination = nil
            return move(to: days.day(of: date))
        case .deleteTapped:
            if state.canChangePlan { state.destination = .confirmDelete }
        case .deleteConfirmed:
            state.destination = nil
            return delete()
        default:
            break
        }
        return nil
    }

    /// The picker opens on the workout's day, between the first and last weeks the Week tab shows.
    private func moveDay(_ days: DayCalendar) -> WorkoutMoveDay? {
        guard state.canChangePlan, let plan = state.plan, let day = plan.date.flatMap(CoachPlanDates.day(fromPlain:))
        else { return nil }
        let today = days.day(of: now())
        let week = days.weekStart(of: today)
        guard let current = days.date(of: day), let todayDate = days.date(of: today),
            let first = days.date(of: week.adding(days: 7 * WeekState.weeks.lowerBound)),
            let last = days.date(of: week.adding(days: 7 * WeekState.weeks.upperBound + 6))
        else { return nil }
        let title = days.longTitle(of: day)
        return WorkoutMoveDay(
            id: plan.id,
            title: plan.title,
            dayTitle: title,
            current: current,
            today: todayDate,
            first: first,
            last: last
        )
    }

    /// Moves the workout on the coach; the page then reads it again on its new day.
    private func move(to day: LocalDay) -> Task<Void, Never>? {
        guard !state.planWrite.isRunning, state.canChangePlan, let plan = state.plan,
            plan.date != CoachPlanDates.plain(day)
        else { return nil }
        state.planWrite = .saving
        let coachPlan = coachPlan
        return Task {
            do {
                try await coachPlan.move(plan.id, to: day)
                state.planWrite = .idle
                await load()
            } catch {
                AppLog.sync.error("Workout not moved: \(String(describing: error), privacy: .public)")
                state.planWrite = .failed(Self.editMessage(error))
            }
        }
    }

    /// Deletes the workout on the coach, then closes the page.
    private func delete() -> Task<Void, Never>? {
        guard !state.planWrite.isRunning, state.canChangePlan, let plan = state.plan else { return nil }
        state.planWrite = .saving
        let coachPlan = coachPlan
        return Task {
            do {
                try await coachPlan.delete(plan.id)
                state.planWrite = .idle
                router.back()
            } catch {
                AppLog.sync.error("Workout not deleted: \(String(describing: error), privacy: .public)")
                state.planWrite = .failed(Self.editMessage(error))
            }
        }
    }

    private nonisolated static func editMessage(_ error: any Error) -> String {
        if case .rejected(409) = error as? SyncTransportError {
            return String(localized: "A done workout stays as it is.")
        }
        return AppResource<WorkoutDetail>.message(for: error)
    }

    /// A Lift session with the coach's exercises, opened at once; the page reads the link back behind it.
    private func startWorkout() -> Task<Void, Never>? {
        guard let starter, !state.planWrite.isRunning, let plan = state.plan, plan.liftSessionId == nil,
            !(plan.exercises ?? []).isEmpty
        else { return nil }
        state.planWrite = .starting
        let today = LocalDay(now(), calendar: calendar)
        return Task {
            do {
                let id = try await starter.start(plan, today: today)
                state.planWrite = .idle
                router.open(.workout(id))
                await load()
            } catch {
                AppLog.sync.error("Workout not started: \(String(describing: error), privacy: .public)")
                state.planWrite = .failed(String(localized: "Could not start the workout. Try again."))
            }
        }
    }

    /// The web's Mark done: the server answers with the workout, and the Week tab reads its plan again.
    private func setDone(_ done: Bool) -> Task<Void, Never>? {
        guard !state.planWrite.isRunning, let plan = state.plan else { return nil }
        state.planWrite = .saving
        let data = data
        let coachPlan = coachPlan
        return Task {
            do {
                let body = try JSONEncoder().encode(["status": done ? "done" : "planned"])
                _ = try await data.put(AppPlannedWorkout.statusPath(plan.id), body: body)
                state.planWrite = .idle
                await load()
                await coachPlan.refresh()
            } catch {
                AppLog.sync.error("Workout status not saved: \(String(describing: error), privacy: .public)")
                state.planWrite = .failed(AppResource<WorkoutDetail>.message(for: error))
            }
        }
    }

    /// One action on "How did it feel": the shared flow decides, and a save runs on the App API.
    private func saveFeedback(_ action: WorkoutFeedbackAction) -> Task<Void, Never>? {
        guard let pending = state.feedback.handle(action, loaded: state.workout.content.value?.feedback) else {
            return nil
        }
        let saver = feedbackSaver
        return Task {
            let saved = await saver.save(pending.feedback)
            state.feedback.finish(saved, attempt: pending.attempt)
        }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.workout) { state.workout = $0 }
    }
}
