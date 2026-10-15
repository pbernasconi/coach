import Core
import Observation

@Observable
final class ExampleViewModel {
    private(set) var state = ExampleState()

    private let repository: any ExampleRepository
    private let router: any Navigating
    private let haptics: any Haptics

    /// Protocols only, no defaults, no work (SCR-3).
    init(repository: any ExampleRepository, router: any Navigating, haptics: any Haptics) {
        self.repository = repository
        self.router = router
        self.haptics = haptics
    }

    /// Started by the Screen's `.task`; cancelled when the view goes away (SCR-4).
    func run() async {
        for await items in repository.observeAll() {
            state.items = items.isEmpty ? .empty : .loaded(items)
        }
    }

    /// Writes return their Task so tests can await them (SCR-5).
    @discardableResult
    func send(_ action: ExampleAction) -> Task<Void, Never>? {
        switch action {
        case .retryTapped:
            state.items = .loading
            return nil
        case .nameChanged(let name):
            state.draftName = name
            return nil
        case .itemTapped(let id):
            router.push(.exampleDetail(id))
            return nil
        case .destinationDismissed:
            state.destination = nil
            return nil
        case .saveTapped:
            guard state.save != .saving else { return nil }  // double tap guard
            state.save = .saving  // set before the Task starts
            let name = state.draftName
            return Task {
                do {
                    try await repository.create(name: name)
                    state.save = .idle
                    state.draftName = ""
                    haptics.play(.success)
                } catch let error as AppError {
                    state.save = .failed(error.kind)
                } catch {
                    state.save = .failed(.unknown)
                }
            }
        }
    }
}
