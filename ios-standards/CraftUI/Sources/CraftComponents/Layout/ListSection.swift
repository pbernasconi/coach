import CraftTokens
import SwiftUI

/// A rounded group of rows with optional header and footer slots. Rows (`ListRow`, `KeyValueRow`) draw a
/// hairline above themselves, inset to their text; the section clips the first one away, so `ForEach` and
/// conditional rows get correct separators with no view erasure.
///
///     ListSection("Account") {
///         ListRow("Profile", action: openProfile)
///         ListRow("Units", value: "kg", action: openUnits)
///     }
public struct ListSection<Header: View, Content: View, Footer: View>: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.displayScale) private var displayScale
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
        VStack(alignment: .leading, spacing: Space.sm) {
            header
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .textCase(.uppercase)
                .padding(.horizontal, Space.lg)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) { content }
                .padding(.top, -1 / displayScale)
                .environment(\.craftInListSection, true)
                .background(theme.palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            footer
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
                .padding(.horizontal, Space.lg)
        }
    }
}

public extension ListSection where Header == Text?, Footer == Text? {
    /// A section with an optional plain title and footer note.
    init(_ title: String? = nil, footer: String? = nil, @ViewBuilder content: () -> Content) {
        self.init(content: content, header: { title.map { Text($0) } }, footer: { footer.map { Text($0) } })
    }
}

public extension ListSection where Footer == EmptyView {
    /// A section with a custom header slot and no footer.
    init(@ViewBuilder content: () -> Content, @ViewBuilder header: () -> Header) {
        self.init(content: content, header: header, footer: { EmptyView() })
    }
}

extension EnvironmentValues {
    /// True inside a `ListSection`: rows draw their top separator.
    @Entry var craftInListSection: Bool = false
}

extension View {
    /// Draws the row's top hairline when inside a `ListSection`, starting `leadingInset` from the edge.
    func listSectionSeparator(leadingInset: CGFloat) -> some View {
        modifier(ListSectionSeparator(leadingInset: leadingInset))
    }
}

private struct ListSectionSeparator: ViewModifier {
    @Environment(\.craftInListSection) private var inSection
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
            VStack(spacing: Space.xxl) {
                ListSection("Account", footer: "Changes sync to all your devices.") {
                    ListRow("Profile", subtitle: "Name, photo", action: {}) {
                        Image(systemName: "person.crop.circle")
                    }
                    ListRow("Units", value: "kg", action: {}) {
                        Image(systemName: "scalemass")
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
            .padding(Space.gutter)
        }
        .background(Theme.system.palette.canvas)
    }
}

#Preview("Light") { ListSectionPreview() }
#Preview("Dark") { ListSectionPreview().preferredColorScheme(.dark) }
#Preview("AX3") { ListSectionPreview().dynamicTypeSize(.accessibility3) }
#endif
