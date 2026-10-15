import Foundation

@testable import Lift

/// An `ImportFlowPresenting` that counts what it was asked to do.
final class RecordingImportFlow: ImportFlowPresenting {
    private(set) var presented = 0
    private(set) var dismissed = 0

    func presentImport() {
        presented += 1
    }

    func dismissImport() {
        dismissed += 1
    }
}
