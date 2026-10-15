import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class ExerciseDetailViewModel {
    /// How many past sessions "Your history" lists.
    static let historyLimit = 5

    private(set) var state = ExerciseDetailState()

    private let exerciseID: UUID
    private let exercises: any ExerciseRepository
    private let history: any ExerciseHistoryRepository
    private let catalog: any ExerciseCatalogProviding
    private let days: DayCalendar
    private let now: @Sendable () -> Date
    @ObservationIgnored private var serial = 0
    /// Every charted session, the range and the touched session behind `state.progress`.
    @ObservationIgnored private var progress: ExerciseProgressTracker
    /// The catalog entry the media and library steps come from.
    @ObservationIgnored private var entry: CatalogExercise?

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        exerciseID: UUID,
        exercises: any ExerciseRepository,
        history: any ExerciseHistoryRepository,
        catalog: any ExerciseCatalogProviding,
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
    }

    /// Observes the exercise and its history; started by the Screen's `.task` (SCR-4).
    func run() async {
        async let library: Void = observeExercise()
        async let past: Void = observeHistory()
        _ = await (library, past)
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
        }
        return nil
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

    private func observeExercise() async {
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
    private func observeHistory() async {
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
