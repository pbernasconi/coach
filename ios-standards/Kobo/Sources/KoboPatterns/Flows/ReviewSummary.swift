import KoboComponents
import KoboTokens
import SwiftUI

/// The hero at the top of a review: the one figure the person is about to confirm ("3 workouts"), a caption over it
/// ("Ready to import"), an optional note under a hairline ("From Mon 7 Oct to Mon 14 Oct"), an optional symbol, and
/// an optional edit link back to the step that set it. Pass `onEdit: nil` while a submit runs, so nothing changes
/// under it.
///
///     ReviewSummary(verbatim: "3 workouts", caption: "Ready to import", note: "14 sets across 3 days",
///                   symbol: "square.and.arrow.down", onEdit: { step = .paste })
public struct ReviewSummary {
    let value: Text
    let caption: Text?
    let note: Text?
    let symbol: String?
    let editLabel: Text
    let onEdit: (() -> Void)?

    /// - Parameter editLabel: the link's words; the library's "Edit" when `nil`.
    public init(
        _ value: LocalizedStringKey,
        caption: LocalizedStringKey? = nil,
        note: LocalizedStringKey? = nil,
        symbol: String? = nil,
        editLabel: LocalizedStringKey? = nil,
        onEdit: (() -> Void)? = nil
    ) {
        self.value = Text(value)
        self.caption = caption.map { Text($0) }
        self.note = note.map { Text($0) }
        self.symbol = symbol
        self.editLabel = editLabel.map { Text($0) } ?? Text("Edit", bundle: .module)
        self.onEdit = onEdit
    }

    /// A summary whose figure, caption and note are shown as is (runtime values).
    public init(
        verbatim value: String,
        caption: String? = nil,
        note: String? = nil,
        symbol: String? = nil,
        editLabel: LocalizedStringKey? = nil,
        onEdit: (() -> Void)? = nil
    ) {
        self.value = Text(verbatim: value)
        self.caption = caption.map { Text(verbatim: $0) }
        self.note = note.map { Text(verbatim: $0) }
        self.symbol = symbol
        self.editLabel = editLabel.map { Text($0) } ?? Text("Edit", bundle: .module)
        self.onEdit = onEdit
    }
}
