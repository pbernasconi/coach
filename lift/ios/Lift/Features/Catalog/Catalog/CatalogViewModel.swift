import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class CatalogViewModel {
    private(set) var state = CatalogState()

    private let catalog: any ExerciseCatalogProviding
    private let exercises: any ExerciseRepository
    private let router: any Navigating
    @ObservationIgnored private var loaded: ExerciseCatalog?

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        catalog: any ExerciseCatalogProviding,
        exercises: any ExerciseRepository,
        router: any Navigating
    ) {
        self.catalog = catalog
        self.exercises = exercises
        self.router = router
    }

    /// Loads the catalog, then follows which entries the library links to; started by the Screen's `.task` (SCR-4).
    func run() async {
        do {
            let loaded = try await catalog.catalog()
            self.loaded = loaded
            state.options = Dictionary(
                uniqueKeysWithValues: CatalogFacet.allCases.map { ($0, loaded.options($0)) }
            )
            state.total = loaded.entries.count
            refresh()
        } catch {
            state.rows = .failed(AppError.kind(of: error))
            return
        }
        for await library in exercises.observeExercises() {
            state.library = Set(library.filter { !$0.isArchived }.compactMap(\.catalogID))
            if state.library.isEmpty { state.filter.inLibrary = false }
            refresh()
        }
    }

    @discardableResult
    func send(_ action: CatalogAction) -> Task<Void, Never>? {
        switch action {
        case .queryChanged(let query):
            state.query = query
        case .filtersTapped:
            state.sheet = .all
            return nil
        case .facetTapped(let facet):
            state.sheet = .facet(facet)
            return nil
        case .optionToggled(let facet, let value):
            state.filter.toggle(value, in: facet)
        case .libraryToggled:
            state.filter.inLibrary.toggle()
        case .facetCleared(let facet):
            state.filter[facet] = []
        case .filtersCleared:
            state.filter = CatalogFilter()
        case .sheetDismissed:
            state.sheet = nil
            return nil
        case .rowAppeared(let id):
            return loadThumbnail(id)
        case .rowTapped(let id):
            router.open(.catalogExercise(id))
            return nil
        case .retryTapped:
            state.rows = .loading
            return Task { await run() }
        }
        refresh()
        return nil
    }

    private func refresh() {
        guard let loaded else { return }
        guard !loaded.entries.isEmpty else {
            state.rows = .empty
            return
        }
        let results = loaded.search(state.query, filter: state.filter, library: state.library)
        state.rows = .loaded(results.map(CatalogRow.init(entry:)))
        state.counts = loaded.facetCounts(state.query, filter: state.filter, library: state.library)
    }

    private func loadThumbnail(_ id: String) -> Task<Void, Never>? {
        guard state.thumbnails[id] == nil, let entry = loaded?.entry(id: id) else { return nil }
        state.thumbnails[id] = .loading
        let catalog = catalog
        return Task {
            state.thumbnails[id] = await catalog.image(.still, for: entry)
        }
    }
}
