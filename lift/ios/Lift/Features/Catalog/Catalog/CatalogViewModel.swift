import Foundation
import LiftCore
import Observation

@Observable
final class CatalogViewModel {
    private(set) var state = CatalogState()

    private let catalog: any ExerciseCatalogProviding
    private let router: any Navigating
    @ObservationIgnored private var loaded: ExerciseCatalog?

    /// Protocols only, no defaults, no work (SCR-3).
    init(catalog: any ExerciseCatalogProviding, router: any Navigating) {
        self.catalog = catalog
        self.router = router
    }

    /// Loads the catalog; started by the Screen's `.task` (SCR-4).
    func run() async {
        do {
            let loaded = try await catalog.catalog()
            self.loaded = loaded
            state.bodyParts = loaded.bodyParts
            state.equipmentKinds = loaded.equipment
            state.total = loaded.entries.count
            refresh()
        } catch {
            state.rows = .failed((error as? AppError)?.kind ?? .unknown)
        }
    }

    @discardableResult
    func send(_ action: CatalogAction) -> Task<Void, Never>? {
        switch action {
        case .queryChanged(let query):
            state.query = query
            refresh()
        case .bodyPartChanged(let choice):
            state.bodyPart = choice
            refresh()
        case .equipmentChanged(let choice):
            state.equipment = choice
            refresh()
        case .rowAppeared(let id):
            return loadThumbnail(id)
        case .rowTapped(let id):
            router.open(.catalogExercise(id))
        case .retryTapped:
            state.rows = .loading
            return Task { await run() }
        }
        return nil
    }

    private func refresh() {
        guard let loaded else { return }
        guard !loaded.entries.isEmpty else {
            state.rows = .empty
            return
        }
        let filter = CatalogFilter(bodyPart: state.bodyPart.value, equipment: state.equipment.value)
        state.rows = .loaded(loaded.search(state.query, filter: filter).map(CatalogRow.init(entry:)))
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
