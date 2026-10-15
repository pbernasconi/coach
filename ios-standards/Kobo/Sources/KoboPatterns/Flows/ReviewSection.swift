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

#if DEBUG
    private struct ReviewSectionPreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xl) {
                    ReviewSection("Workout", onEdit: {}) {
                        ReviewRow("Date", value: "Mon 14 Oct", onEdit: {})
                        ReviewRow("Exercises", value: "3")
                    }
                    ReviewSection(verbatim: "Bench press") {
                        ReviewRow("Sets", value: "3 × 8")
                        ReviewRow("Load", value: "80 kg")
                    }
                    ReviewDisclosure("Show the pasted text", subtitle: "4 lines") {
                        Text(verbatim: "Mon 14 Oct\nBench press 3x8 80kg")
                    }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Light") { ReviewSectionPreview() }
    #Preview("Dark") { ReviewSectionPreview().preferredColorScheme(.dark) }
    #Preview("AX3, Lift") { ReviewSectionPreview().koboTheme(.lift).dynamicTypeSize(.accessibility3) }
#endif
