import Foundation
import Observation

/// The Share extension's one screen: read the shared note, then on Send leave it in the App Group inbox and ask the
/// system to open Lift at Import (`lift://import`). Share extensions may not open their app on every system; when the
/// request is refused, the note waits in the inbox and Lift opens it in Import the next time it comes to the front.
@Observable
final class ShareNoteModel {
    enum Step: Equatable {
        case reading
        /// The note's text, ready to send.
        case ready(String)
        /// Saved in the inbox; Lift could not be opened from here, so the person opens it.
        case sent
        /// The share held no text.
        case noText
        /// This build names no App Group, so the note cannot reach the app.
        case unavailable
    }

    private(set) var step = Step.reading
    private let items: [Any]
    private let inbox: (any NoteInboxing)?
    @ObservationIgnored private weak var context: NSExtensionContext?

    init(items: [Any], inbox: (any NoteInboxing)?, context: NSExtensionContext?) {
        self.items = items
        self.inbox = inbox
        self.context = context
    }

    /// Reads the shared text; started by the view's `.task`.
    func load() async {
        guard step == .reading else { return }
        let text = await SharedNoteReader.text(from: items)
        step = text.map(Step.ready) ?? .noText
    }

    /// Send: keeps the note for Lift and asks to open it at Import.
    func send() {
        guard case .ready(let text) = step else { return }
        guard let inbox else {
            step = .unavailable
            return
        }
        inbox.put(text)
        guard let url = AppLink.importNote(text: nil).url, let context else {
            step = .sent
            return
        }
        context.open(url) { @Sendable opened in
            Task { @MainActor in self.finishSend(openedLift: opened) }
        }
    }

    /// Cancel or Done: closes the share sheet. Done after a send keeps the note in the inbox for Lift.
    func close() {
        if case .ready = step {
            context?.cancelRequest(withError: CocoaError(.userCancelled))
        } else {
            context?.completeRequest(returningItems: nil)
        }
    }

    private func finishSend(openedLift: Bool) {
        if openedLift {
            context?.completeRequest(returningItems: nil)
        } else {
            step = .sent
        }
    }
}
