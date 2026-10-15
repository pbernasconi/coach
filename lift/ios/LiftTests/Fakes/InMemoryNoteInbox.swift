import Foundation
import Synchronization

@testable import Lift

/// A `NoteInboxing` in memory, standing in for the App Group inbox the Share extension fills.
nonisolated final class InMemoryNoteInbox: NoteInboxing {
    private let text: Mutex<String?>

    init(_ text: String? = nil) {
        self.text = Mutex(text)
    }

    func put(_ text: String) {
        self.text.withLock { $0 = text }
    }

    func take() -> String? {
        text.withLock { text in
            defer { text = nil }
            return text
        }
    }
}
