import Foundation
import LiftCore
import LiftStore
import LiftSync
import Observation

@Observable
final class ExerciseDetailViewModel {
    /// How many past sessions "Your history" lists.
    static let historyLimit = 5

    private(set) var state = ExerciseDetailState()

    /// The library exercise; nil for an exercise the coach knows only by name (a `name-…` key).
    private let exerciseID: UUID?
    private let exercises: any ExerciseRepository
    private let history: any ExerciseHistoryRepository
    private let catalog: any ExerciseCatalogProviding
    private let days: DayCalendar
    private let now: @Sendable () -> Date
    private let router: any Navigating
    /// The coach's numbers for the exercise key.
    private let server: AppResource<LiftExerciseStats>
    /// When the coach's numbers last came fresh; a return within `LiftRefresh.interval` keeps them.
    @ObservationIgnored private var serverFetchedAt: Date?
    @ObservationIgnored private var serial = 0
    @ObservationIgnored private var isLoadingServer = false
    /// Every charted session, the range and the touched session behind `state.progress`.
    @ObservationIgnored private var progress: ExerciseProgressTracker
    /// The catalog entry the media and library steps come from.
    @ObservationIgnored private var entry: CatalogExercise?

    /// Protocols only, no defaults, no work (SCR-3).
    /// - Parameter exerciseKey: the coach's key (`id-<uuid>` or `name-<name>`), for `/api/app/lift/exercises/{key}`.
    init(
        exerciseID: UUID?,
        exerciseKey: String,
        exercises: any ExerciseRepository,
        history: any ExerciseHistoryRepository,
        catalog: any ExerciseCatalogProviding,
        data: any AppDataSource,
        router: any Navigating,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        unit: WeightUnit
    ) {
        self.exerciseID = exerciseID
        self.exercises = exercises
        self.history = history
        self.catalog = catalog
        self.now = now
        let days = DayCalendar(calendar: calendar)
        self.days = days
        self.progress = ExerciseProgressTracker(days: days, unit: unit)
        self.router = router
        self.server = AppResource(path: LiftLinks.exercisePath(exerciseKey), source: data, now: now, days: days)
    }

    /// Observes the exercise and its history, and loads the coach's numbers; started by the Screen's `.task` (SCR-4).
    /// An exercise known only by name has no library entry and no local history.
    func run() async {
        guard let exerciseID else {
            state.exercise = .empty
            state.history = .empty
            await loadServerUnlessFresh()
            return
        }
        async let library: Void = observeExercise(exerciseID)
        async let past: Void = observeHistory(exerciseID)
        async let coach: Void = loadServerUnlessFresh()
        _ = await (library, past, coach)
    }

    @discardableResult
    func send(_ action: ExerciseDetailAction) -> Task<Void, Never>? {
        switch action {
        case .videosTapped:
            guard case .loaded(let item) = state.exercise, let url = item.videoURL else { return nil }
            serial += 1
            state.link = LinkRequest(serial: serial, url: url)
        case .libraryStepsExpandedChanged(let isExpanded):
            state.isLibraryStepsExpanded = isExpanded
        case .progressRangeChanged(let range):
            progress.select(range: range, today: today)
            state.progress = progress.state
        case .progressSelectionChanged(let date):
            progress.select(date: date, today: today)
            state.progress = progress.state
        case .serverChartSelectionChanged(let date):
            guard let date else { return nil }
            state.serverPoint = ExerciseServerPoint.nearest(to: date, in: state.serverChart)
        case .serverSessionsExpandedChanged(let isExpanded):
            state.isServerSessionsExpanded = isExpanded
        case .sessionTapped(let sessionID):
            router.open(LiftLinks.session(sessionID))
        case .refreshPulled:
            return Task { await loadServer() }
        case .retryTapped:
            state.server.content = .loading
            return Task { await loadServer() }
        }
        return nil
    }

    /// Loads the coach's numbers and the chart points behind them. One load at a time.
    private func loadServer() async {
        guard !isLoadingServer else { return }
        isLoadingServer = true
        defer { isLoadingServer = false }
        await server.load(current: state.server) { loaded in
            state.server = loaded
            state.serverChart = ExerciseServerPoint.points(loaded.content.value?.chart.value?.points ?? [], days: days)
            if let point = state.serverPoint, !state.serverChart.contains(point) { state.serverPoint = nil }
        }
        if state.server.content.value != nil, state.server.freshness?.isOffline == false { serverFetchedAt = now() }
    }

    private func loadServerUnlessFresh() async {
        guard !LiftRefresh.isFresh(serverFetchedAt, now: now()) else { return }
        await loadServer()
    }

    /// Loads the animation for `state.media`; the Screen restarts it whenever the media changes
    /// (`.task(id: state.media)`), and cancelling it drops the result.
    func loadAnimation() async {
        guard state.media != nil, let entry else { return }
        state.animation = .loading
        let image = await catalog.image(.animation, for: entry)
        guard !Task.isCancelled else { return }
        state.animation = image
    }

    private func observeExercise(_ exerciseID: UUID) async {
        for await library in exercises.observeExercises() {
            if let exercise = library.first(where: { $0.id == exerciseID }) {
                state.exercise = .loaded(ExerciseDetailItem(exercise: exercise))
                await showCatalog(id: exercise.catalogID, hasGuide: ExerciseGuide.for(id: exercise.id) != nil)
            } else {
                state.exercise = .empty
            }
        }
    }

    /// The media and, without an authored guide, the steps of the exercise's catalog entry.
    private func showCatalog(id: String?, hasGuide: Bool) async {
        guard id != entry?.id else { return }
        let entry: CatalogExercise? = if let id { await catalog.entry(id: id) } else { nil }
        self.entry = entry
        state.media = if let entry { await catalog.media(for: entry) } else { nil }
        state.librarySteps = hasGuide ? [] : entry?.steps ?? []
    }

    /// One read for both the chart (every session) and "Your history" (the latest `historyLimit`).
    private func observeHistory(_ exerciseID: UUID) async {
        let stream = history.observeHistory(exerciseID: exerciseID, limit: ExerciseProgressTracker.sessionLimit)
        for await entries in stream {
            let rows = entries.prefix(Self.historyLimit).map { ExerciseHistoryRow(entry: $0, days: days) }
            state.history = rows.isEmpty ? .empty : .loaded(rows)
            progress.show(entries, today: today)
            state.progress = progress.state
        }
    }

    private var today: LocalDay { days.day(of: now()) }
}
