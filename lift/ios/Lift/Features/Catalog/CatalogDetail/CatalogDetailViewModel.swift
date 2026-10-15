import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class CatalogDetailViewModel {
    private(set) var state = CatalogDetailState()

    private let catalogID: String
    private let catalog: any ExerciseCatalogProviding
    private let exercises: any ExerciseRepository
    private let router: any Navigating
    private let history: any ExerciseHistoryRepository
    private let now: @Sendable () -> Date
    private let days: DayCalendar
    @ObservationIgnored private var entry: CatalogExercise?
    @ObservationIgnored private var serial = 0
    /// The library exercise's charted sessions, range and touched session behind `state.progress`.
    @ObservationIgnored private var progress: ExerciseProgressTracker

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        catalogID: String,
        catalog: any ExerciseCatalogProviding,
        exercises: any ExerciseRepository,
        router: any Navigating,
        history: any ExerciseHistoryRepository,
        now: @escaping @Sendable () -> Date,
        calendar: Calendar,
        unit: WeightUnit
    ) {
        self.catalogID = catalogID
        self.catalog = catalog
        self.exercises = exercises
        self.router = router
        self.history = history
        self.now = now
        let days = DayCalendar(calendar: calendar)
        self.days = days
        self.progress = ExerciseProgressTracker(days: days, unit: unit)
    }

    /// Loads the entry and its animation, and watches the library; started by the Screen's `.task` (SCR-4).
    func run() async {
        async let media: Void = loadEntry()
        async let library: Void = observeLibrary()
        _ = await (media, library)
    }

    @discardableResult
    func send(_ action: CatalogDetailAction) -> Task<Void, Never>? {
        switch action {
        case .addTapped:
            return add()
        case .libraryExerciseTapped:
            if case .present(let id) = state.library { router.open(.exercise(id)) }
            return nil
        case .progressRangeChanged(let range):
            progress.select(range: range, today: today)
            state.progress = progress.state
            return nil
        case .progressSelectionChanged(let date):
            progress.select(date: date, today: today)
            state.progress = progress.state
            return nil
        }
    }

    /// The library exercise behind this entry, while there is one: the Screen restarts `observeProgress()` when it
    /// changes (`.task(id:)`).
    var libraryExerciseID: UUID? {
        if case .present(let id) = state.library { id } else { nil }
    }

    /// Charts the library exercise's history; restarted by the Screen whenever `libraryExerciseID` changes, and
    /// cancelled with it. Without a library exercise there is nothing to chart.
    func observeProgress() async {
        guard let exerciseID = libraryExerciseID else {
            state.progress.chart = .empty
            return
        }
        for await entries in history.observeHistory(exerciseID: exerciseID, limit: ExerciseProgressTracker.sessionLimit)
        {
            progress.show(entries, today: today)
            state.progress = progress.state
        }
    }

    private var today: LocalDay { days.day(of: now()) }

    private func loadEntry() async {
        guard let entry = await catalog.entry(id: catalogID) else {
            state.entry = .empty
            state.animation = .failed
            return
        }
        self.entry = entry
        state.entry = .loaded(CatalogDetailItem(entry: entry))
        state.animation = await catalog.image(.animation, for: entry)
    }

    private func observeLibrary() async {
        for await library in exercises.observeExercises() {
            guard state.library != .adding else { continue }
            let match = library.first { $0.catalogID == catalogID && !$0.isArchived }
            state.library = match.map { .present($0.id) } ?? .absent
        }
    }

    private func add() -> Task<Void, Never>? {
        guard state.library == .absent, let entry else { return nil }
        state.library = .adding  // set before the Task starts, so a double tap writes once
        let exercises = exercises
        return Task {
            do {
                let exercise = try await exercises.create(fromCatalog: entry)
                state.library = .present(exercise.id)
                showToast(.added(name: exercise.name))
            } catch {
                state.library = .absent
                showToast(.failed)
            }
        }
    }

    private func showToast(_ kind: CatalogToast.Kind) {
        serial += 1
        state.toast = CatalogToast(serial: serial, kind: kind)
    }
}
