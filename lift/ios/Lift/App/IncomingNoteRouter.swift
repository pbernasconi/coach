import Foundation

/// Opens Import from Notes with a given text. `ImportFlowPresenter` is the live one; tests record the calls.
protocol ImportTextPresenting: AnyObject {
    /// Whether Import from Notes is on screen.
    var isShowingImport: Bool { get }
    /// Opens Import from Notes with `text`, reading it at once when `readsOnOpen`.
    func present(text: String, readsOnOpen: Bool)
}

extension ImportFlowPresenter: ImportTextPresenting {
    var isShowingImport: Bool { request != nil }
}

/// Brings notes into Import from Notes: a `lift://import` link (`AppLink`), and a note shared from Apple Notes through
/// the Share extension, which leaves it in the App Group inbox. A share extension cannot reliably open its app, so the
/// app also checks the inbox whenever it comes to the foreground. A shared note opens straight on the review step;
/// nothing is written until Import is tapped there.
final class IncomingNoteRouter {
    private let inbox: (any NoteInboxing)?
    private let importFlow: any ImportTextPresenting

    init(inbox: (any NoteInboxing)?, importFlow: any ImportTextPresenting) {
        self.inbox = inbox
        self.importFlow = importFlow
    }

    /// Handles `url`. Returns false when it is not a Lift link.
    @discardableResult
    func open(_ url: URL) -> Bool {
        guard case .importNote(let text)? = AppLink(url: url) else { return false }
        if let text = text ?? inbox?.take() {
            importFlow.present(text: text, readsOnOpen: true)
        } else if !importFlow.isShowingImport {
            importFlow.present(text: "", readsOnOpen: false)
        }
        return true
    }

    /// Lift came to the foreground: a note shared while it was away opens in Import.
    func checkInbox() {
        guard let text = inbox?.take() else { return }
        importFlow.present(text: text, readsOnOpen: true)
    }
}
