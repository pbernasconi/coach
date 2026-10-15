import KoboComponents
import KoboTokens
import SwiftUI

/// Where a `ScreenScaffold` puts its title and toolbar.
public enum ScreenHeaderStyle: Sendable, Equatable {
    /// Inside a `NavigationStack`: a large `.navigationTitle`, toolbar items in the navigation bar
    /// (the system draws them on glass). Kicker and subtitle sit at the top of the content.
    case navigationBar
    /// Outside a `NavigationStack` (a tab root without a stack, a sheet): a custom large header that
    /// scrolls with the content, with the toolbar slot as glass circular buttons beside the title.
    case inline
}

/// The standard screen frame: large title with optional kicker and subtitle, trailing toolbar buttons,
/// scrolling content inside the page gutter on the canvas, and an optional pinned footer. The scroll view is the root,
/// so the navigation bar's scroll-edge effect attaches to it, `.refreshable { … }` on the scaffold adds pull to
/// refresh, and dragging the content dismisses the keyboard. Inline toolbar buttons are glass circles, or flat ones
/// under a `.solid` theme.
///
///     ScreenScaffold("Week", subtitle: "3 of 4 tasks") {
///         DayStrip(…)
///     } toolbar: {
///         Button("Add", systemImage: "plus", action: add)
///     } footer: {
///         Button("Plan the week", action: plan).buttonStyle(.glassProminent)
///     }
public struct ScreenScaffold<Content: View, Toolbar: View, Footer: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let subtitle: Text?
    private let kicker: Text?
    private let headerStyle: ScreenHeaderStyle
    private let content: Content
    private let toolbar: Toolbar
    private let footer: Footer

    /// A screen with a localized title, toolbar buttons and a pinned footer.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        kicker: LocalizedStringKey? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder toolbar: () -> Toolbar,
        @ViewBuilder footer: () -> Footer
    ) {
        self.init(
            header: ScaffoldTexts(title, subtitle: subtitle, kicker: kicker),
            headerStyle: headerStyle,
            content: content(),
            toolbar: toolbar(),
            footer: footer()
        )
    }

    /// A screen whose title, subtitle and kicker are shown as is (a record's name), with toolbar and footer.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder toolbar: () -> Toolbar,
        @ViewBuilder footer: () -> Footer
    ) {
        self.init(
            header: ScaffoldTexts(verbatim: title, subtitle: subtitle, kicker: kicker),
            headerStyle: headerStyle,
            content: content(),
            toolbar: toolbar(),
            footer: footer()
        )
    }

    /// The one place every initialiser lands.
    init(header: ScaffoldTexts, headerStyle: ScreenHeaderStyle, content: Content, toolbar: Toolbar, footer: Footer) {
        self.title = header.title
        self.subtitle = header.subtitle
        self.kicker = header.kicker
        self.headerStyle = headerStyle
        self.content = content
        self.toolbar = toolbar
        self.footer = footer
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                if headerStyle == .inline || kicker != nil || subtitle != nil {
                    ScaffoldHeader(
                        title: title,
                        subtitle: subtitle,
                        kicker: kicker,
                        showsTitle: headerStyle == .inline,
                        toolbar: toolbar
                    )
                }
                content
            }
            .padding(.horizontal, Space.gutter)
            .padding(.bottom, Space.xxl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(theme.palette.canvas)
        .modifier(ScaffoldNavigation(style: headerStyle, title: title, toolbar: toolbar))
        .pinnedFooter(isPresented: Footer.self != EmptyView.self) { footer }
    }
}

#if DEBUG
    private struct ScreenScaffoldPreview: View {
        let style: ScreenHeaderStyle

        var body: some View {
            ScreenScaffold("Week", subtitle: "3 of 4 tasks", kicker: "October", headerStyle: style) {
                ForEach(1..<12) { index in
                    Text("Card \(index)").koboCard()
                }
            } toolbar: {
                Button("Add task", systemImage: "plus") {}
            } footer: {
                Button("Plan the week") {}
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
            }
        }
    }

    #Preview("Navigation bar") { NavigationStack { ScreenScaffoldPreview(style: .navigationBar) } }
    #Preview("Inline") { ScreenScaffoldPreview(style: .inline) }
    #Preview("Dark") { NavigationStack { ScreenScaffoldPreview(style: .navigationBar) }.preferredColorScheme(.dark) }
    #Preview("AX3") { ScreenScaffoldPreview(style: .inline).dynamicTypeSize(.accessibility3) }
#endif
