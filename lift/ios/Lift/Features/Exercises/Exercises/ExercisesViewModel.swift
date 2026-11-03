import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class ExercisesViewModel {
    private(set) var state = ExercisesState()

    private let exercises: any ExerciseRepository
    private let catalog: any ExerciseCatalogProviding
    private let router: any Navigating

    /// Protocols only, no defaults, no work (SCR-3).
    init(exercises: any ExerciseRepository, catalog: any ExerciseCatalogProviding, router: any Navigating) {
        self.exercises = exercises
        self.catalog = catalog
        self.router = router
    }

    /// Observes the library; started by the Screen's `.task` (SCR-4).
    func run() async {
        for await library in exercises.observeExercises() {
            let items = library.filter { !$0.isArchived }.map { ExerciseItem(exercise: $0) }
            state.exercises = items.isEmpty ? .empty : .loaded(items)
        }
    }

    @discardableResult
    func send(_ action: ExercisesAction) -> Task<Void, Never>? {
        switch action {
        case .queryChanged(let query):
            state.query = query
        case .exerciseTapped(let id):
            router.open(.exercise(id))
        case .thumbnailNeeded(let catalogID):
            return loadThumbnail(catalogID)
        case .allExercisesTapped:
            router.open(.catalog)
        }
        return nil
    }

    private func loadThumbnail(_ catalogID: String) -> Task<Void, Never>? {
        guard state.thumbnails[catalogID] == nil else { return nil }
        state.thumbnails[catalogID] = .loading
        let catalog = catalog
        return Task { state.thumbnails[catalogID] = await catalog.image(.still, catalogID: catalogID) }
    }
}
