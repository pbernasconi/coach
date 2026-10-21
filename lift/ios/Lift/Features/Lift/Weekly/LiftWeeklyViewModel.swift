import Foundation
import Observation

@Observable
final class LiftWeeklyViewModel {
    /// The App API path of the screen.
    static let path = "api/app/lift/weekly"

    private(set) var state = LiftWeeklyState()

    private let resource: AppResource<LiftWeekly>
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(data: any AppDataSource, now: @escaping @Sendable () -> Date, calendar: Calendar) {
        resource = AppResource(path: Self.path, source: data, now: now, days: DayCalendar(calendar: calendar))
    }

    /// Loads the page; started by the Screen's `.task` (SCR-4).
    func run() async {
        await load()
    }

    @discardableResult
    func send(_ action: LiftWeeklyAction) -> Task<Void, Never>? {
        switch action {
        case .refreshPulled:
            return Task { await load() }
        case .retryTapped:
            state.weekly.content = .loading
            return Task { await load() }
        }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.weekly) { state.weekly = $0 }
    }
}
