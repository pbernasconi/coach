import KoboComponents
import KoboTokens
import SwiftUI

/// A titled group of review rows: a heading with an optional "Edit" button that jumps back to the step that set these
/// values, then the rows in a rounded `ListSection` card. Key a `ForEach` of rows on a stable id, never on the label.
///
///     ReviewSection("Workouts", onEdit: { step = .paste }) {
///         ReviewRow("Found", value: "3 workouts")
///         ReviewRow("Skipped lines", value: "2")
///     }
public struct ReviewSection<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let onEdit: (() -> Void)?
    private let content: Content

    /// A section with a localized title.
    public init(_ title: LocalizedStringKey, onEdit: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.title = Text(title)
        self.onEdit = onEdit
        self.content = content()
    }

    /// A section whose title is shown as is (a day or a record's name).
    public init(verbatim title: String, onEdit: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.title = Text(verbatim: title)
        self.onEdit = onEdit
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            header
            ListSection { content } header: { EmptyView() }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            title
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let onEdit {
                Button(action: onEdit) {
                    Text("Edit", bundle: .module)
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.accentText)
                        .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("Edit \(title)", bundle: .module))
            }
        }
        .padding(.horizontal, Space.lg)
        .frame(minHeight: Size.minTouch)
    }
}
