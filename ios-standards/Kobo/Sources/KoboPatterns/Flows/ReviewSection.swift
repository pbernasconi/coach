import KoboComponents
import KoboTokens
import SwiftUI

/// A titled group of review rows: a quiet section title (the same look as a `ListSection` header) with an optional
/// "Edit" button that jumps back to the step that set these values, then the rows in a `ListSection` (flat on a page).
/// The heading sits on the page keyline. Key a `ForEach` of rows on a stable id, never on the label.
///
///     ReviewSection("Tasks", onEdit: { step = .paste }) {
///         ReviewRow("Found", value: "12 tasks")
///         ReviewRow("Skipped lines", value: "2")
///     }
public struct ReviewSection<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.listSectionStyle) private var style
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
        VStack(alignment: .leading, spacing: style.captionGap) {
            header
            ListSection {
                content
            } header: {
                EmptyView()
            }
        }
    }

    /// The title in the one section-title look (`sectionTitleStyle()`), like every list section's header; with an
    /// Edit link the line grows to the link's 44pt target.
    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            title
                .sectionTitleStyle()
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
    }
}

#if DEBUG
    private struct ReviewSectionPreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xl) {
                    ReviewSection("List", onEdit: {}) {
                        ReviewRow("Date", value: "Mon 14 Oct", onEdit: {})
                        ReviewRow("Tasks", value: "3")
                    }
                    ReviewSection(verbatim: "Write the report") {
                        ReviewRow("Due", value: "Friday")
                        ReviewRow("Estimate", value: "2 h")
                    }
                    ReviewDisclosure("Show the pasted text", subtitle: "4 lines") {
                        Text(verbatim: "Mon 14 Oct\nWrite the report 2h")
                    }
                }
                .padding(.vertical, Space.gutter)
                .pageGutter()
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Light") { ReviewSectionPreview() }
    #Preview("Dark") { ReviewSectionPreview().preferredColorScheme(.dark) }
    #Preview("AX3, Amber") { ReviewSectionPreview().koboTheme(.amber).dynamicTypeSize(.accessibility3) }
#endif
