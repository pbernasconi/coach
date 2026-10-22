@testable import Lift

/// A `ScreenLinkOpening` that records each destination it was asked to open.
@MainActor
final class RecordingScreenLinks: ScreenLinkOpening {
    private(set) var opened: [ScreenDestination] = []

    func open(_ destination: ScreenDestination) {
        opened.append(destination)
    }
}
