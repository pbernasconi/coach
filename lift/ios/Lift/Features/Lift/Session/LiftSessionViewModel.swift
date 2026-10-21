import Foundation
import KoboPatterns
import LiftCore
import LiftSync
import Observation

/// One Lift session as the coach shows it (lift/APP-API.md, "Session"), read-only. It shows what the server sends.
@Observable
final class LiftSessionViewModel {
    private(set) var state: LiftSessionState

    private let resource: AppResource<LiftSessionDetail>
    private let mediaLoader: any ExerciseMediaLoader
    private let router: any Navigating
    @ObservationIgnored private var isLoading = false

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        sessionID: String,
        data: any AppDataSource,
        mediaLoader: any ExerciseMediaLoader,
        router: any Navigating,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar
    ) {
        self.state = LiftSessionState(sessionID: sessionID)
        self.resource = AppResource(
            path: LiftSessionDetail.path(sessionID),
            source: data,
            now: now,
            days: DayCalendar(calendar: calendar)
        )
        self.mediaLoader = mediaLoader
        self.router = router
    }

    /// Started by the Screen's `.task`; cancelled when the view goes away (SCR-4).
    func run() async {
        await load()
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: LiftSessionAction) -> Task<Void, Never>? {
        switch action {
        case .retryTapped:
            state.detail.content = .loading
            return Task { await load() }
        case .refreshPulled:
            return Task { await load() }
        case .olderTapped:
            replace(with: session?.olderId)
        case .newerTapped:
            replace(with: session?.newerId)
        case .lastTimeTapped(let id):
            router.open(LiftLinks.session(id))
        case .exerciseTapped(let key):
            router.open(LiftLinks.exercise(key))
        case .mediaNeeded(let exerciseID):
            return loadMedia(exerciseID)
        case .stepsExpandedChanged(let exerciseID, let isExpanded):
            if isExpanded {
                state.expandedSteps.insert(exerciseID)
            } else {
                state.expandedSteps.remove(exerciseID)
            }
        }
        return nil
    }

    private var session: LiftSessionDetail? { state.detail.content.value }

    /// Swaps this page for a neighbour, so the stack does not grow with each step through the sessions.
    private func replace(with sessionID: String?) {
        guard let sessionID else { return }
        router.back()
        router.open(LiftLinks.session(sessionID))
    }

    private func loadMedia(_ exerciseID: String) -> Task<Void, Never>? {
        guard state.media[exerciseID] == nil,
            let exercise = session?.exercises.value?.items.first(where: { $0.id == exerciseID }),
            let url = exercise.media?.image
        else { return nil }
        state.media[exerciseID] = .loading
        let loader = mediaLoader
        return Task { state.media[exerciseID] = await MediaImage.load(url, with: loader) }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        await resource.load(current: state.detail) { state.detail = $0 }
    }
}
