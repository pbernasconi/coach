import Foundation

@testable import Lift

/// A clipboard holding fixed text (or none), and counting reads.
final class FakePasteboard: TextPasteboard {
    private let content: String?
    private(set) var reads = 0

    init(text: String?) {
        content = text
    }

    func text() -> String? {
        reads += 1
        return content
    }
}
