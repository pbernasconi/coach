import Foundation
import LiftCore
import LiftStore
import Observation

/// One opening of a template link: its `d` value, read by the review sheet.
nonisolated struct TemplateLinkRequest: Identifiable, Hashable, Sendable {
    /// Counts openings, so a second link is a new sheet.
    let id: Int
    let payload: String
}

/// Opens the template link review; `TemplateLinkPresenter` is the live one, tests record the calls.
protocol TemplateLinkPresenting: AnyObject {
    func present(payload: String)
}

/// What the review sheet tells the shell when it closes.
protocol TemplateLinkFlow: AnyObject {
    /// The templates were added: close the sheet and offer Undo.
    func finish(_ addition: TemplateLinkAddition, count: Int)
    /// Cancel or ✕: close the sheet; nothing was written.
    func cancel()
}

/// The shell's message after a template link: added (with Undo), or Undo failed.
nonisolated struct TemplateLinkToast: Equatable, Sendable {
    enum Kind: Equatable, Sendable {
        case added(count: Int)
        case undoFailed
    }

    /// Changes with every message, so the same message can show twice.
    var serial: Int
    var kind: Kind
}

/// Opens `lift://templates` links as a review sheet above the tabs, closes it, and undoes the last addition. The
/// shell shows `toast` in its own toast slot, since the sheet is gone by then.
@Observable
final class TemplateLinkPresenter: TemplateLinkPresenting, TemplateLinkFlow {
    private(set) var request: TemplateLinkRequest?
    private(set) var toast: TemplateLinkToast?
    @ObservationIgnored private var lastAddition: TemplateLinkAddition?
    @ObservationIgnored private var openings = 0
    @ObservationIgnored private var messages = 0
    private let templates: any TemplateRepository
    private let exercises: any ExerciseRepository

    init(templates: any TemplateRepository, exercises: any ExerciseRepository) {
        self.templates = templates
        self.exercises = exercises
    }

    func present(payload: String) {
        openings += 1
        request = TemplateLinkRequest(id: openings, payload: payload)
    }

    func finish(_ addition: TemplateLinkAddition, count: Int) {
        request = nil
        lastAddition = addition
        show(.added(count: count))
    }

    func cancel() {
        request = nil
    }

    /// The toast's Undo: takes the last addition back. Runs once; a second tap finds nothing to undo.
    func undo() async {
        guard let addition = lastAddition else { return }
        lastAddition = nil
        do {
            try await addition.undo(templates: templates, exercises: exercises)
        } catch {
            AppLog.templates.error("Undoing a template link failed: \(String(describing: error), privacy: .private)")
            show(.undoFailed)
        }
    }

    private func show(_ kind: TemplateLinkToast.Kind) {
        messages += 1
        toast = TemplateLinkToast(serial: messages, kind: kind)
    }
}
