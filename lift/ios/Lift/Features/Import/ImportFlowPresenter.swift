import Foundation
import Observation

/// Opens and closes the Import from Notes flow. The History screen opens it; the flow closes itself (SCR-3).
protocol ImportFlowPresenting: AnyObject {
    /// Opens the flow on an empty paste step.
    func presentImport()
    /// Closes the flow.
    func dismissImport()
}

/// One opening of the import flow: the text it starts with, and whether it reads that text straight away.
nonisolated struct ImportRequest: Identifiable, Hashable, Sendable {
    /// Counts openings, so a new opening is a new page.
    let id: Int
    let text: String
    /// True for `-open import` in demo mode: the sample is read at once and the flow opens on the review step.
    let readsOnOpen: Bool
}

/// The app shell's presenter: `request` drives the modal page above the tabs.
@Observable
final class ImportFlowPresenter: ImportFlowPresenting {
    private(set) var request: ImportRequest?
    private var openings = 0

    func presentImport() {
        present(text: "", readsOnOpen: false)
    }

    /// Opens the flow with `text` already in the paste step (shared or sample text).
    func present(text: String, readsOnOpen: Bool) {
        openings += 1
        request = ImportRequest(id: openings, text: text, readsOnOpen: readsOnOpen)
    }

    func dismissImport() {
        request = nil
    }
}
