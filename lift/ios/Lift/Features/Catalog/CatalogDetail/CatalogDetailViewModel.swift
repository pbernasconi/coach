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
    @ObservationIgnored private var entry: CatalogExercise?
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(
        catalogID: String,
        catalog: any ExerciseCatalogProviding,
        exercises: any ExerciseRepository,
        router: any Navigating
    ) {
        self.catalogID = catalogID
        self.catalog = catalog
        self.exercises = exercises
        self.router = router
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
        }
    }

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
