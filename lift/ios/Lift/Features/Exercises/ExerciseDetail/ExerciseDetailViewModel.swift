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
    @ObservationIgnored private var serial = 0
    /// The catalog entry the media and library steps come from.
    @ObservationIgnored private var entry: CatalogExercise?

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        exerciseID: UUID,
        exercises: any ExerciseRepository,
        history: any ExerciseHistoryRepository,
        catalog: any ExerciseCatalogProviding,
        calendar: Calendar
    ) {
        self.exerciseID = exerciseID
        self.exercises = exercises
        self.history = history
        self.catalog = catalog
        self.days = DayCalendar(calendar: calendar)
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

    private func observeHistory() async {
        for await entries in history.observeHistory(exerciseID: exerciseID, limit: Self.historyLimit) {
            let rows = entries.map { ExerciseHistoryRow(entry: $0, days: days) }
            state.history = rows.isEmpty ? .empty : .loaded(rows)
        }
    }
}
