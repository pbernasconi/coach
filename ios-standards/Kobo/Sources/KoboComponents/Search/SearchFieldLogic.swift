import Foundation

/// The rules of the search pill (`SearchField`), apart from SwiftUI.
nonisolated enum SearchFieldLogic {
    /// The inline clear glyph. Beside a cancel button it shows only while the field has focus and text, as the system
    /// search field does; out of focus the cancel button clears. With no cancel button it shows whenever there is text,
    /// so a query always has a clear control.
    static func showsClear(query: String, isFocused: Bool, hasCancel: Bool) -> Bool {
        !query.isEmpty && (isFocused || !hasCancel)
    }

    /// The cancel button beside the pill: while the field has focus or holds a query.
    static func showsCancel(query: String, isFocused: Bool) -> Bool {
        isFocused || !query.isEmpty
    }

    /// The query a search reads: trimmed, or `nil` when blank.
    static func needle(_ query: String) -> String? {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

/// The rules of a search mode that commits its query (`koboSearchable` with `onSubmit`), apart from SwiftUI.
nonisolated enum SearchModeLogic {
    /// The hint line shows until the query has this many characters; then the suggestions own the space.
    static let hintCharacterLimit = 2

    /// Whether the hint line ("Search names and notes") shows under the field.
    static func showsHint(query: String) -> Bool {
        query.trimmingCharacters(in: .whitespaces).count < hintCharacterLimit
    }

    /// The Search key commits a query with text. A blank query commits only while a query is already committed: that
    /// commit removes it, so a cleared field is never a dead end.
    static func canSubmit(query: String, committed: String) -> Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty || !committed.isEmpty
    }
}
