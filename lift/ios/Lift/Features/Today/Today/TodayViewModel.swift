import Foundation
import LiftCore
import LiftSync
import Observation

@Observable
final class TodayViewModel {
    private(set) var state = TodayState()

    private let resource: AppResource<AppToday>
    private let coachPlan: any CoachPlanProviding
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let days: DayCalendar
    /// The kept week plan, for the detail sheet of a planned workout.
    @ObservationIgnored private var plan = CoachPlanSnapshot.off
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        data: any AppDataSource,
        coachPlan: any CoachPlanProviding,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        anchor: TodayAnchor?
    ) {
        let days = DayCalendar(calendar: calendar)
        self.days = days
        self.resource = AppResource(path: AppToday.path, source: data, now: now, days: days)
        self.coachPlan = coachPlan
        self.router = router
        self.tabs = tabs
        state.anchor = anchor
    }

    /// Loads the page and follows the week plan; started by the Screen's `.task` (SCR-4).
    func run() async {
        await withDiscardingTaskGroup { group in
            group.addTask { await self.load() }
            group.addTask { await self.observePlan() }
        }
    }

    private func observePlan() async {
        for await snapshot in coachPlan.snapshots() { plan = snapshot }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.today) { state.today = $0 }
    }

    @discardableResult
    func send(_ action: TodayAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled, .retryTapped:
            if action == .retryTapped { state.today.content = .loading }
            return Task { await load() }
        case .lineItemTapped(let id):
            openLineItem(id)
        case .mainLiftTapped(let key):
            router.open(.liftExercise(key))
        case .liftSessionTapped(let id):
            router.open(.liftSession(id))
        case .planActivityTapped(let id):
            state.destination = nil
            router.open(.activity(id))
        case .connectTapped:
            tabs.show(.settings)
        case .destinationDismissed:
            state.destination = nil
        }
        return nil
    }

    /// A lift opens its session; another workout opens its detail from the kept week plan, when the plan has it.
    private func openLineItem(_ id: String) {
        let item = state.today.content.value?.todayLine.value?.items.first { $0.id == id }
        if let session = item?.liftSessionId {
            router.open(.liftSession(session))
            return
        }
        for week in plan.shownBook?.weeks.values.map(\.self) ?? [] {
            for day in week.days {
                if let found = day.items.first(where: { $0.id == id }) {
                    state.destination = .planItem(WeekPlanItem(found, dayTitle: days.longTitle(of: day.date)))
                    return
                }
            }
        }
    }
}
