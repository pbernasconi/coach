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

/// Routes the links that open Lift (`AppLink`). A `lift://import` link and a note shared from Apple Notes through the
/// Share extension, which leaves it in the App Group inbox, go to Import from Notes. A share extension cannot reliably
/// open its app, so the app also checks the inbox whenever it comes to the foreground. A shared note opens straight on
/// the review step; nothing is written until Import is tapped there. A `lift://templates` link opens the template link
/// review, which writes nothing until its Add button is tapped.
final class IncomingNoteRouter {
    private let inbox: (any NoteInboxing)?
    private let importFlow: any ImportTextPresenting
    private let templateLinks: any TemplateLinkPresenting

    init(
        inbox: (any NoteInboxing)?,
        importFlow: any ImportTextPresenting,
        templateLinks: any TemplateLinkPresenting
    ) {
        self.inbox = inbox
        self.importFlow = importFlow
        self.templateLinks = templateLinks
    }

    /// Handles `url`. Returns false when it is not a Lift link.
    @discardableResult
    func open(_ url: URL) -> Bool {
        switch AppLink(url: url) {
        case .importNote(let text)?:
            openImport(text: text)
            return true
        case .templates(let payload)?:
            templateLinks.present(payload: payload)
            return true
        case nil:
            return false
        }
    }

    private func openImport(text: String?) {
        if let text = text ?? inbox?.take() {
            importFlow.present(text: text, readsOnOpen: true)
        } else if !importFlow.isShowingImport {
            importFlow.present(text: "", readsOnOpen: false)
        }
    }

    /// Lift came to the foreground: a note shared while it was away opens in Import.
    func checkInbox() {
        guard let text = inbox?.take() else { return }
        importFlow.present(text: text, readsOnOpen: true)
    }
}
