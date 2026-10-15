import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class TemplatesViewModel {
    private(set) var state = TemplatesState()

    private let templates: any TemplateRepository
    private let router: any Navigating
    /// True while "New template" is creating one, so a double tap makes one template (SCR-5).
    @ObservationIgnored private var isCreating = false
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(templates: any TemplateRepository, router: any Navigating) {
        self.templates = templates
        self.router = router
    }

    /// Observes the templates; started by the Screen's `.task` (SCR-4).
    func run() async {
        for await list in templates.observeTemplates() {
            state.templates = list.isEmpty ? .empty : .loaded(list.map(TemplateItem.init(template:)))
            if let shown = state.options {
                state.options = items.first { $0.id == shown.id }
            }
        }
    }

    @discardableResult
    func send(_ action: TemplatesAction) -> Task<Void, Never>? {
        switch action {
        case .templateTapped(let id):
            router.open(.template(id))
        case .newTemplateTapped:
            return create()
        case .optionsTapped(let id):
            state.options = items.first { $0.id == id }
        case .optionsDismissed:
            state.options = nil
        case .removeTapped(let id):
            return remove(id)
        case .undoRemoveTapped(let id):
            return write { try await $0.restoreTemplate(id: id) }
        }
        return nil
    }

    private var items: [TemplateItem] {
        guard case .loaded(let items) = state.templates else { return [] }
        return items
    }

    private func create() -> Task<Void, Never>? {
        guard !isCreating else { return nil }
        isCreating = true
        let name = TemplateText.newName(taken: items.map(\.name))
        return Task {
            defer { isCreating = false }
            do {
                let template = try await templates.createTemplate(name: name)
                router.open(.template(template.id))
            } catch {
                showToast(.failed)
            }
        }
    }

    private func remove(_ id: UUID) -> Task<Void, Never>? {
        state.options = nil
        guard let item = items.first(where: { $0.id == id }) else { return nil }
        return write { repository in
            try await repository.removeTemplate(id: id)
            self.showToast(.removed(id, name: item.name))
        }
    }

    /// Runs one write; a failure shows the "could not save" toast.
    private func write(_ body: @escaping (any TemplateRepository) async throws -> Void) -> Task<Void, Never> {
        let templates = templates
        return Task {
            do {
                try await body(templates)
            } catch {
                showToast(.failed)
            }
        }
    }

    private func showToast(_ kind: TemplatesToast.Kind) {
        serial += 1
        state.toast = TemplatesToast(serial: serial, kind: kind)
    }
}
