import Foundation
import LiftSync
import Observation

@Observable
final class WeighInViewModel {
    private(set) var state = WeighInState()

    private let resource: AppResource<AppWeighIn>
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let days: DayCalendar
    @ObservationIgnored private var hasLoaded = false
    @ObservationIgnored private var isLoading = false

    /// `day` is `YYYY-MM-DD` or `latest`. Protocols only, no defaults, no work (SCR-3).
    init(
        day: String,
        data: any AppDataSource,
        router: any Navigating,
        tabs: any TabSwitching,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        days = DayCalendar(calendar: calendar)
        resource = AppResource(path: AppWeighIn.path(day), source: data, now: now, days: days)
        self.router = router
        self.tabs = tabs
    }

    /// Loads the weigh-in once; started by the Screen's `.task` (SCR-4). A weigh-in does not change after the day.
    func run() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        await load()
    }

    @discardableResult
    func send(_ action: WeighInAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled:
            return Task { await load() }
        case .retryTapped:
            state.weighIn.content = .loading
            return Task { await load() }
        case .connectTapped:
            tabs.show(.settings)
            return nil
        case .dayTapped(let day):
            router.open(.weighIn(CoachPlanDates.plain(day.day)))
            return nil
        }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.weighIn) { state.weighIn = $0 }
        state.neighbours = neighbours(of: state.weighIn.content.value)
    }

    private func neighbours(of weighIn: AppWeighIn?) -> [WeighInNeighbour] {
        let sides: [(WeighInNeighbour.Side, PlainDay?)] = [
            (.earlier, weighIn?.olderDate), (.later, weighIn?.newerDate),
        ]
        return sides.compactMap { side, day in
            day.map { WeighInNeighbour(side: side, day: $0, dayText: days.shortTitle(of: $0.day)) }
        }
    }
}
