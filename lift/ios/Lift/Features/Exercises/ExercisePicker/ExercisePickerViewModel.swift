import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class ExercisePickerViewModel {
    private(set) var state = ExercisePickerState()

    private let target: ExercisePickerTarget
    private let exercises: any ExerciseRepository
    private let catalog: any ExerciseCatalogProviding
    private let templates: any TemplateRepository
    private let plans: any WorkoutPlanRepository
    private let router: any Navigating
    @ObservationIgnored private var loaded: ExerciseCatalog?
    /// The library by id, for the exercise a row adds.
    @ObservationIgnored private var library: [UUID: Exercise] = [:]

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        target: ExercisePickerTarget,
        exercises: any ExerciseRepository,
        catalog: any ExerciseCatalogProviding,
        templates: any TemplateRepository,
        plans: any WorkoutPlanRepository,
        router: any Navigating
    ) {
        self.target = target
        self.exercises = exercises
        self.catalog = catalog
        self.templates = templates
        self.plans = plans
        self.router = router
        state.isSwap = target.swapped != nil
    }

    /// Loads the catalog, then observes the library; started by the Screen's `.task` (SCR-4).
    func run() async {
        do {
            loaded = try await catalog.catalog()
            refreshCatalog()
        } catch {
            state.catalog = .failed(AppError.kind(of: error))
        }
        for await list in exercises.observeExercises() {
            let live = list.filter { !$0.isArchived }
            library = Dictionary(live.map { ($0.id, $0) }) { first, _ in first }
            state.library = live.isEmpty ? .empty : .loaded(live.map { ExerciseItem(exercise: $0) })
            if state.isSwap {
                state.suggested = SwapSuggestions.library(live, like: swappedExercise).map(ExerciseItem.init(exercise:))
                refreshCatalog()
            }
        }
    }

    @discardableResult
    func send(_ action: ExercisePickerAction) -> Task<Void, Never>? {
        switch action {
        case .queryChanged(let query):
            state.query = query
            refreshCatalog()
        case .sourceChanged(let source):
            state.source = source
        case .libraryTapped(let id):
            return pick(.library(id))
        case .catalogTapped(let id):
            return pick(.catalog(id))
        case .thumbnailNeeded(let catalogID):
            return loadThumbnail(catalogID)
        }
        return nil
    }

    private func refreshCatalog() {
        guard let loaded else { return }
        guard !loaded.entries.isEmpty else {
            state.catalog = .empty
            return
        }
        var results = loaded.search(state.query)
        if state.isSwap, state.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            results = SwapSuggestions.catalog(results, like: swappedExercise)
        }
        state.catalog = .loaded(results.map(CatalogRow.init(entry:)))
    }

    /// The library exercise being swapped out, once the library has loaded.
    private var swappedExercise: Exercise? {
        target.swapped?.exerciseID.flatMap { library[$0] }
    }

    /// Adds the picked exercise to the template or session (or swaps it in), then goes back. One pick at a time
    /// (SCR-5).
    private func pick(_ pick: ExercisePickerState.Pick) -> Task<Void, Never>? {
        guard state.adding == nil else { return nil }
        state.adding = pick
        return Task {
            defer { state.adding = nil }
            do {
                let exercise = try await exercise(for: pick)
                switch target {
                case .template(let id): _ = try await templates.addExercise(exercise, to: id)
                case .session(let id): _ = try await plans.addExercise(exercise, to: id)
                case .swap(let id, _): _ = try await plans.swapExercise(id, to: exercise)
                }
                router.back()
            } catch {
                state.failures += 1
            }
        }
    }

    /// The library exercise a pick names; a catalog entry is added to the library first (or found there).
    private func exercise(for pick: ExercisePickerState.Pick) async throws -> Exercise {
        switch pick {
        case .library(let id):
            guard let exercise = library[id] else { throw AppError(.notFound, detail: "exercise \(id)") }
            return exercise
        case .catalog(let id):
            guard let entry = loaded?.entry(id: id) else { throw AppError(.notFound, detail: "catalog \(id)") }
            return try await exercises.create(fromCatalog: entry)
        }
    }

    private func loadThumbnail(_ catalogID: String) -> Task<Void, Never>? {
        guard state.thumbnails[catalogID] == nil else { return nil }
        state.thumbnails[catalogID] = .loading
        let catalog = catalog
        return Task { state.thumbnails[catalogID] = await catalog.image(.still, catalogID: catalogID) }
    }
}
