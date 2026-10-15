import KoboComponents
import KoboTokens
import SwiftUI

/// One label and value of a `ReviewSection`. VoiceOver reads "label, value" as one element, and the value stacks
/// under the label at accessibility sizes. With `onEdit` the whole row is a button with a chevron that jumps back to
/// the step that set the value; it keeps the spoken value, because people must hear what they confirm, and adds the
/// hint "Edit".
///
///     ReviewRow("Date", value: "Mon 14 Oct", onEdit: { step = .paste })
///     ReviewRow(verbatim: exercise.name, value: "3 × 8 · 80 kg")
public struct ReviewRow: View {
    private enum Label {
        case localized(LocalizedStringKey)
        case verbatim(String)
    }

    private let label: Label
    private let value: String
    private let onEdit: (() -> Void)?

    /// A row with a localized label and a value shown as is.
    public init(_ label: LocalizedStringKey, value: String, onEdit: (() -> Void)? = nil) {
        self.label = .localized(label)
        self.value = value
        self.onEdit = onEdit
    }

    /// A row whose label is shown as is (user data).
    public init(verbatim label: String, value: String, onEdit: (() -> Void)? = nil) {
        self.label = .verbatim(label)
        self.value = value
        self.onEdit = onEdit
    }

    public var body: some View {
        if let onEdit {
            editable(onEdit).accessibilityHint(Text("Edit", bundle: .module))
        } else {
            switch label {
            case .localized(let key): ListRow(key, value: value)
            case .verbatim(let text): ListRow(verbatim: text, value: value)
            }
        }
    }

    @ViewBuilder private func editable(_ onEdit: @escaping () -> Void) -> some View {
        switch label {
        case .localized(let key): ListRow(key, value: value, action: onEdit)
        case .verbatim(let text): ListRow(verbatim: text, value: value, action: onEdit)
        }
    }
}
