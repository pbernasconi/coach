import Foundation
import LiftSync
import Observation

/// One planned workout's page (lift/APP-API.md, "Planned workout"): what the server sends, as the web shows it.
@Observable
final class PlannedWorkoutViewModel {
    private(set) var state = PlannedWorkoutState()

    private let resource: AppResource<AppPlannedWorkout>
    private let router: any Navigating
    private let tabs: any TabSwitching
    @ObservationIgnored private var isLoading = false

    /// `planID` is the Week API item's id. Protocols only, no defaults, no work (SCR-3).
    init(
        planID: String,
        data: any AppDataSource,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        resource = AppResource(
            path: AppPlannedWorkout.path(planID),
            source: data,
            now: now,
            days: DayCalendar(calendar: calendar)
        )
        self.router = router
        self.tabs = tabs
    }

    /// Started by the Screen's `.task` (SCR-4); the plan can change, so each appearance loads again.
    func run() async {
        await load()
    }

    @discardableResult
    func send(_ action: PlannedWorkoutAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled:
            return Task { await load() }
        case .retryTapped:
            state.workout.content = .loading
            return Task { await load() }
        case .connectTapped:
            tabs.show(.settings)
        case .activityTapped(let id):
            router.open(.activity(id))
        case .sessionTapped(let id):
            router.open(LiftLinks.session(id))
        }
        return nil
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.workout) { state.workout = $0 }
    }
}
