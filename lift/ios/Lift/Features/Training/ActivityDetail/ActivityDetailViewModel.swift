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
    private let router: any Navigating
    private let tabs: any TabSwitching
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    /// - Parameter ref: the workout, `WorkoutDetail.planRef(_:)` or `WorkoutDetail.stravaRef(_:)`.
    init(
        ref: String,
        seed: ActivitySeed?,
        data: any AppDataSource,
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
        }
        return nil
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
