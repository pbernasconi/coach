import KoboTokens
import SwiftUI

/// A group of rows with optional header and footer slots, in one of two styles (`ListSectionStyle`). The header is a
/// quiet sentence-case title (`sectionTitleStyle()`), never upper-cased (DL-H3):
/// `.flat` (the default, for a page's top-level lists) runs full-width rows on the canvas, each paying the page gutter,
/// so the row content, the header and the footer share the page's one keyline; `.grouped` (forms and sheets) puts the
/// rows in a rounded card whose edge sits on that keyline. Rows (`ListRow`, `KeyValueRow`) draw a hairline above
/// themselves, inset to their text; the section clips the first one away, so `ForEach` and conditional rows get
/// correct separators with no view erasure. Content that is not a row pays the gutter with `.pageGutter()`.
///
///     ListSection("Account") {
///         ListRow("Profile", action: openProfile)
///         ListRow("Units", value: "km", action: openUnits)
///     }
public struct ListSection<Header: View, Content: View, Footer: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.displayScale) private var displayScale
    @Environment(\.listSectionStyle) private var style
    @Environment(\.insidePageGutter) private var insidePageGutter
    private let header: Header
    private let content: Content
    private let footer: Footer

    /// A section with custom header and footer slots.
    public init(
        @ViewBuilder content: () -> Content,
        @ViewBuilder header: () -> Header,
        @ViewBuilder footer: () -> Footer
    ) {
        self.content = content()
        self.header = header()
        self.footer = footer()
    }

    public var body: some View {
        let captionInset = style.captionInset(insidePageGutter: insidePageGutter)
        VStack(alignment: .leading, spacing: style.captionGap) {
            header
                .sectionTitleStyle()
                .padding(.horizontal, captionInset)
            rows
            footer
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
                .padding(.horizontal, captionInset)
        }
    }

    /// The rows, their first hairline clipped away: bled to the screen edges when flat, on a card when grouped.
    @ViewBuilder private var rows: some View {
        let stack = VStack(spacing: 0) { content }
            .padding(.top, -1 / displayScale)
            .environment(\.koboInListSection, true)
            // The rows pay their own inset, so content inside them is no longer inside the page gutter.
            .insidePageGutter(false)
        switch style {
        case .flat:
            stack
                .clipShape(Rectangle())
                .padding(.horizontal, -style.rowBleed(insidePageGutter: insidePageGutter))
        case .grouped:
            stack
                .background(theme.palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        }
    }
}

extension ListSection where Header == Text?, Footer == Text? {
    /// A section with an optional localized title and footer note.
    public init(
        _ title: LocalizedStringKey? = nil,
        footer: LocalizedStringKey? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.init(title: title.map { Text($0) }, footer: footer.map { Text($0) }, content: content)
    }

    /// A section whose title and footer are shown as is (user data).
    public init(verbatim title: String, footer: String? = nil, @ViewBuilder content: () -> Content) {
        self.init(title: Text(verbatim: title), footer: footer.map { Text(verbatim: $0) }, content: content)
    }

    /// A section with ready-made title and footer texts.
    init(title: Text?, footer: Text?, @ViewBuilder content: () -> Content) {
        self.init(content: content, header: { title }, footer: { footer })
    }
}

extension ListSection where Footer == EmptyView {
    /// A section with a custom header slot and no footer.
    public init(@ViewBuilder content: () -> Content, @ViewBuilder header: () -> Header) {
        self.init(content: content, header: header, footer: { EmptyView() })
    }
}

extension EnvironmentValues {
    /// True inside a `ListSection`: rows draw their top separator.
    @Entry var koboInListSection: Bool = false
}

extension View {
    /// Draws the row's top hairline when inside a `ListSection`, starting `leadingInset` from the edge.
    func listSectionSeparator(leadingInset: CGFloat) -> some View {
        modifier(ListSectionSeparator(leadingInset: leadingInset))
    }
}

private struct ListSectionSeparator: ViewModifier {
    @Environment(\.koboInListSection) private var inSection
    let leadingInset: CGFloat

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if inSection {
                Separator(leadingInset: leadingInset)
            }
        }
    }
}

#if DEBUG
    private struct ListSectionPreview: View {
        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xxl) {
                    SectionHeader("Flat (top-level lists)")
                    sections
                    SectionHeader("Grouped (forms and sheets)")
                    sections.listSectionStyle(.grouped)
                }
                .pageGutter()
            }
            .background(Theme.system.palette.canvas)
        }

        private var sections: some View {
            VStack(spacing: Space.xxl) {
                ListSection("Account", footer: "Changes sync to all your devices.") {
                    ListRow("Profile", subtitle: "Name, photo", action: {}) {
                        Image(systemName: "person.crop.circle").accessibilityHidden(true)
                    }
                    ListRow("Units", value: "km", action: {}) {
                        Image(systemName: "ruler").accessibilityHidden(true)
                    }
                    ListRow("Version", value: "1.0")
                }
                ListSection {
                    ListRow("No header", action: {})
                    ListRow("Second row", action: {})
                } header: {
                    Label("Custom header", systemImage: "gear")
                }
            }
        }
    }

    #Preview("Light") { ListSectionPreview() }
    #Preview("Dark") { ListSectionPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { ListSectionPreview().dynamicTypeSize(.accessibility3) }
#endif
