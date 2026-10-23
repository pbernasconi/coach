import Foundation
import LiftCore
import LiftStore
import LiftSync
import Observation

@Observable
final class WorkoutSummaryViewModel {
    private(set) var state = WorkoutSummaryState()

    private let sessionID: UUID
    private let sessions: any SessionRepository
    private let history: any ExerciseHistoryRepository
    private let router: any Navigating
    /// Saving finished workouts to Apple Health; the first summary asks.
    private let health: any WorkoutHealthRecording
    private let days: DayCalendar
    private let feedbackSaver: WorkoutFeedbackSaver
    private let now: @Sendable () -> Date
    /// The check-in opens once, the first time a just-finished session loads.
    @ObservationIgnored private var hasAskedCheckIn = false
    /// This session's empty feedback, for the check-in.
    @ObservationIgnored private var blankFeedback: WorkoutFeedback?
    /// The save in flight, so a slower earlier answer never overwrites a newer one.
    @ObservationIgnored private var saveAttempt = 0
    /// Where Apple Health stood when the summary opened, updated by the prompt's answers.
    @ObservationIgnored private var healthStatus = HealthStatus.notSaved
    /// Each library exercise's sets logged before this workout, read once.
    @ObservationIgnored private var earlier: [UUID: [LoggedSet]] = [:]
    @ObservationIgnored private var hasReadEarlier = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessionID: UUID,
        sessions: any SessionRepository,
        history: any ExerciseHistoryRepository,
        health: any WorkoutHealthRecording,
        router: any Navigating,
        data: any AppDataSource,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.sessionID = sessionID
        self.sessions = sessions
        self.history = history
        self.health = health
        self.router = router
        self.days = DayCalendar(calendar: calendar)
        self.feedbackSaver = WorkoutFeedbackSaver(data: data)
        self.now = now
    }

    /// Observes the session; started by the Screen's `.task` (SCR-4). The earlier history is read once, the first time
    /// the session loads.
    func run() async {
        healthStatus = health.status()
        for await detail in sessions.observeSession(id: sessionID) {
            guard let detail else {
                state.summary = .empty
                state.health = nil
                continue
            }
            state.health = healthRow(detail.session)
            askCheckIn(detail.session)
            let earlier = await earlierSets(before: detail)
            let unit = detail.session.unitsAtLog
            let summary = WorkoutSummarizer.summarize(detail.domain, earlier: earlier, unit: unit)
            state.summary = .loaded(
                WorkoutSummaryOverview(
                    title: detail.session.title,
                    dayTitle: days.longTitle(of: detail.session.day),
                    duration: summary.duration.map(WorkoutSummaryText.duration),
                    sets: "\(summary.setsLogged)",
                    bests: summary.bests.map { WorkoutSummaryText.best($0, unit: unit) }
                )
            )
        }
    }

    @discardableResult
    func send(_ action: WorkoutSummaryAction) -> Task<Void, Never>? {
        switch action {
        case .doneTapped:
            router.backToRoot()  // the workout is over: home, not back to its sets
        case .healthAllowTapped:
            guard state.health == .ask else { return nil }
            state.health = nil  // "Saved to Apple Health" shows once the workout is saved
            let id = sessionID
            return Task { healthStatus = await health.allow(savingSession: id) }
        case .healthNotNowTapped:
            guard state.health == .ask else { return nil }
            state.health = nil
            healthStatus = .off
            return Task { _ = await health.setEnabled(false) }
        case .checkIn(let action):
            return checkIn(action)
        case .feedbackTapped:
            guard let feedback = state.feedback ?? blankFeedback else { return nil }
            state.checkIn = WorkoutCheckIn(feedback: feedback)
        case .feedbackRetryTapped:
            guard state.feedbackSave == .failed, let feedback = state.feedback else { return nil }
            return save(feedback)
        }
        return nil
    }

    private func checkIn(_ action: WorkoutCheckInAction) -> Task<Void, Never>? {
        guard var checkIn = state.checkIn else { return nil }
        switch action {
        case .effortChanged(let value):
            guard (1...10).contains(value) else { return nil }
            checkIn.feedback.rpe = value  // the dial sets, it never clears
            checkIn.feedback.fromWatch = false
        case .feelTapped(let value):
            checkIn.feedback = checkIn.feedback.applying(.feel(value))
        case .nextTapped:
            checkIn.step = .feel
        case .backTapped:
            checkIn.step = .effort
        case .skipTapped:
            state.checkIn = nil
            return nil
        case .saveTapped:
            state.checkIn = nil
            guard checkIn.canSave, checkIn.feedback != state.feedback else { return nil }
            return save(checkIn.feedback)
        }
        state.checkIn = checkIn
        return nil
    }

    /// Shows what was logged at once, then saves it; the row says "Saved" or offers to try again.
    private func save(_ feedback: WorkoutFeedback) -> Task<Void, Never> {
        state.feedback = feedback
        state.feedbackSave = .saving
        saveAttempt += 1
        let attempt = saveAttempt
        let saver = feedbackSaver
        return Task {
            let saved = await saver.save(feedback)
            guard attempt == saveAttempt else { return }
            state.feedbackSave = saved == nil ? .failed : .saved
        }
    }

    /// Opens the check-in once, when the session finished in the last few minutes (the finish brought you here).
    private func askCheckIn(_ session: SessionRecord) {
        let id = session.id.uuidString.lowercased()
        let day = session.day
        blankFeedback = .blank(
            item: "lift:\(id)",
            date: String(format: "%04d-%02d-%02d", day.year, day.month, day.day),
            title: session.title
        )
        guard !hasAskedCheckIn, let finished = session.finishedAt, let blank = blankFeedback else { return }
        let age = now().timeIntervalSince(finished)
        guard age >= 0, age < WorkoutCheckInWindow.seconds else { return }
        hasAskedCheckIn = true
        state.checkIn = WorkoutCheckIn(feedback: blank)
    }

    /// "Saved to Apple Health" once the workout is there; the prompt on a finished workout while Health was never
    /// asked (the first finish); nothing otherwise.
    private func healthRow(_ session: SessionRecord) -> SummaryHealth? {
        if session.healthWorkoutID != nil { return .saved }
        return session.finishedAt != nil && healthStatus == .notAsked ? .ask : nil
    }

    /// The sets of each library exercise in `detail` logged in sessions before it (an earlier day, or earlier the same
    /// day), read once.
    private func earlierSets(before detail: SessionDetail) async -> [UUID: [LoggedSet]] {
        if hasReadEarlier { return earlier }
        let session = detail.session
        var result: [UUID: [LoggedSet]] = [:]
        for exerciseID in Set(detail.items.compactMap(\.exercise.exerciseID)) {
            for await entries in history.observeHistory(exerciseID: exerciseID, limit: 500) {
                result[exerciseID] = entries.filter { entry in
                    entry.session.id != session.id
                        && (entry.session.day < session.day
                            || (entry.session.day == session.day && entry.session.createdAt < session.createdAt))
                }
                .flatMap { $0.sets.map(\.loggedSet) }
                break
            }
        }
        earlier = result
        hasReadEarlier = true
        return result
    }
}
