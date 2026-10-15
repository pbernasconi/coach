import Foundation

/// The Share extension's hand-off to the app: the text of a note shared from Apple Notes, kept until Lift opens it in
/// Import from Notes. One note at a time; a newer share replaces an older one that was never opened.
nonisolated protocol NoteInboxing: Sendable {
    /// Keeps `text` for the app.
    func put(_ text: String)
    /// The kept text, removed as it is read; nil when there is none.
    func take() -> String?
}

/// The inbox in the App Group's defaults, shared by the app and LiftShare (both compile this file). The defaults are
/// opened on each call, so neither process reads a stale copy.
nonisolated struct AppGroupNoteInbox: NoteInboxing {
    static let key = "sharedNote"
    /// The longest note kept, in characters. A workout log is a few thousand; anything far longer is not one.
    static let maximumLength = 200_000
    let suiteName: String

    init(suiteName: String) {
        self.suiteName = suiteName
    }

    /// The inbox of the App Group `bundle` names; nil when its Info.plist names none.
    init?(bundle: Bundle) {
        guard let suiteName = AppGroup.identifier(in: bundle) else { return nil }
        self.init(suiteName: suiteName)
    }

    func put(_ text: String) {
        AppGroup.defaults(suiteName: suiteName)?.set(String(text.prefix(Self.maximumLength)), forKey: Self.key)
    }

    func take() -> String? {
        let defaults = AppGroup.defaults(suiteName: suiteName)
        guard let text = defaults?.string(forKey: Self.key) else { return nil }
        defaults?.removeObject(forKey: Self.key)
        return text.isEmpty ? nil : text
    }
}
