import Foundation
import LiftCore
import LiftSync
import Observation

/// The Today tab: today's planned workouts, then the web's Health page. It shows what the server sends.
@Observable
final class TodayViewModel {
    private(set) var state = TodayState()

    private let data: any AppDataSource
    private let today: AppResource<AppToday>
    private let coachPlan: any CoachPlanProviding
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    /// The kept week plan, for the detail sheet of a planned workout.
    @ObservationIgnored private var plan = CoachPlanSnapshot.off

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
        self.data = data
        self.now = now
        self.today = AppResource(path: AppToday.path, source: data, now: now, days: days)
        self.coachPlan = coachPlan
        self.router = router
        self.tabs = tabs
        state.anchor = anchor
    }

    /// Loads both pages and follows the week plan; started by the Screen's `.task` (SCR-4).
    func run() async {
        await withDiscardingTaskGroup { group in
            group.addTask { await self.load() }
            group.addTask { await self.observePlan() }
        }
    }

    private func observePlan() async {
        for await snapshot in coachPlan.snapshots() { plan = snapshot }
    }

    /// Today's plan and the health page, side by side.
    private func load() async {
        async let plan: Void = loadToday()
        async let health: Void = loadHealth()
        _ = await (plan, health)
    }

    private func loadToday() async {
        await today.load(current: state.today) { state.today = $0 }
    }

    /// The health page for the shown window. An answer for a window no longer shown is dropped.
    private func loadHealth() async {
        let range = state.range
        let resource = AppResource<AppHealth>(
            path: AppHealth.path,
            source: data,
            now: now,
            days: days,
            query: range.query
        )
        await resource.load(current: state.health) { update in
            guard state.range == range else { return }
            state.health = update
        }
    }

    @discardableResult
    func send(_ action: TodayAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled:
            return Task { await load() }
        case .retryTapped:
            state.today.content = .loading
            state.health.content = .loading
            return Task { await load() }
        case .trendRangeChanged(let range):
            guard range != state.range else { return nil }
            state.range = range
            return Task { await loadHealth() }
        case .lineItemTapped(let id):
            openLineItem(id)
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
            router.open(LiftLinks.session(session))
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
