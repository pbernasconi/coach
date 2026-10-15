import Foundation

@testable import Lift

/// An `ImportTextPresenting` that records each opening.
final class RecordingImportTextPresenter: ImportTextPresenting {
    nonisolated struct Opening: Equatable, Sendable {
        let text: String
        let readsOnOpen: Bool
    }

    private(set) var openings: [Opening] = []
    var isShowingImport = false

    func present(text: String, readsOnOpen: Bool) {
        openings.append(Opening(text: text, readsOnOpen: readsOnOpen))
        isShowingImport = true
    }
}
