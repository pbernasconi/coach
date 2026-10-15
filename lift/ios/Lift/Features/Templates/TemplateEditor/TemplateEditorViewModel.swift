import Foundation
import LiftCore
import LiftStore
import Observation

@Observable
final class TemplateEditorViewModel {
    private(set) var state = TemplateEditorState()

    private let templateID: UUID
    private let templates: any TemplateRepository
    private let router: any Navigating
    /// The unit loads are shown and edited in.
    private let unit: WeightUnit
    /// The latest template from the store; the source for the slot editor and reordering.
    @ObservationIgnored private var template: DayTemplate?
    @ObservationIgnored private var serial = 0

    /// Protocols only, no defaults, no work (SCR-3).
    init(templateID: UUID, templates: any TemplateRepository, router: any Navigating, unit: WeightUnit) {
        self.templateID = templateID
        self.templates = templates
        self.router = router
        self.unit = unit
    }

    /// Observes the template; started by the Screen's `.task` (SCR-4). The name field takes the stored name once.
    func run() async {
        for await template in templates.observeTemplate(id: templateID) {
            if self.template == nil, let template { state.name = template.name }
            self.template = template
            guard let template else {
                state.template = .empty
                state.editor = nil
                continue
            }
            state.template = .loaded(overview(template))
        }
    }

    @discardableResult
    func send(_ action: TemplateEditorAction) -> Task<Void, Never>? {
        switch action {
        case .nameChanged(let name): state.name = name
        case .nameCommitted: return commitName()
        case .slotTapped(let id): openEditor(id)
        case .addExerciseTapped: router.open(.exercisePicker(.template(templateID)))
        case .editorDoneTapped: return saveEditor()
        case .moveUpTapped(let id): return move(id, by: -1)
        case .moveDownTapped(let id): return move(id, by: 1)
        case .removeTapped(let id): return remove(id)
        case .removeUndoTapped(let id): return write { try await $0.restoreExercise(id: id) }
        default: sendEditor(action)
        }
        return nil
    }

    /// The slot editor's steppers, and closing it without saving.
    private func sendEditor(_ action: TemplateEditorAction) {
        if action == .editorDismissed {
            state.editor = nil
        } else {
            state.editor = state.editor?.applying(action)
        }
    }

    private func overview(_ template: DayTemplate) -> TemplateOverview {
        TemplateOverview(
            size: TemplateText.size(exercises: template.exercises.count, sets: template.totalSets),
            slots: template.exercises.enumerated().map { index, slot in
                TemplateSlotItem(
                    id: slot.id,
                    number: index + 1,
                    name: slot.displayName,
                    detail: TemplateText.slot(slot, unit: unit)
                )
            }
        )
    }

    /// Saves a changed, non-blank name; a blank one goes back to the stored name.
    private func commitName() -> Task<Void, Never>? {
        guard let template else { return nil }
        let name = state.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            state.name = template.name
            return nil
        }
        guard name != template.name else { return nil }
        return write { [templateID] in try await $0.renameTemplate(id: templateID, to: name) }
    }

    private func openEditor(_ id: UUID) {
        guard let slots = template?.exercises, let index = slots.firstIndex(where: { $0.id == id }) else { return }
        state.editor = SlotEditor(slot: slots[index], index: index, count: slots.count, unit: unit)
    }

    /// Done: saves the slot when something changed.
    private func saveEditor() -> Task<Void, Never>? {
        guard let editor = state.editor else { return nil }
        state.editor = nil
        guard editor.hasChanges, let slot = template?.exercises.first(where: { $0.id == editor.id }) else { return nil }
        let saved = editor.saving(into: slot)
        return write { _ = try await $0.updateExercise(saved) }
    }

    /// Moves a slot one place up or down.
    private func move(_ id: UUID, by offset: Int) -> Task<Void, Never>? {
        state.editor = nil
        guard var ids = template?.exercises.map(\.id), let index = ids.firstIndex(of: id),
            ids.indices.contains(index + offset)
        else { return nil }
        ids.swapAt(index, index + offset)
        return write { [templateID] in try await $0.reorderExercises(in: templateID, ids: ids) }
    }

    private func remove(_ id: UUID) -> Task<Void, Never>? {
        state.editor = nil
        guard template?.exercises.contains(where: { $0.id == id }) == true else { return nil }
        return write { repository in
            try await repository.removeExercise(id: id)
            self.showToast(.removed(id))
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

    private func showToast(_ kind: TemplateEditorToast.Kind) {
        serial += 1
        state.toast = TemplateEditorToast(serial: serial, kind: kind)
    }
}
