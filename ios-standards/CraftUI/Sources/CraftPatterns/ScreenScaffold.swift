import CraftComponents
import CraftTokens
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
/// scrolling content inside the page gutter on the canvas, and an optional pinned footer.
///
///     ScreenScaffold("Week", subtitle: "3 of 4 workouts") {
///         DayStrip(…)
///     } toolbar: {
///         Button("Add", systemImage: "plus", action: add)
///     } footer: {
///         Button("Start workout", action: start).buttonStyle(.glassProminent)
///     }
public struct ScreenScaffold<Content: View, Toolbar: View, Footer: View>: View {
    @Environment(\.craftTheme) private var theme
    private let title: String
    private let subtitle: String?
    private let kicker: String?
    private let headerStyle: ScreenHeaderStyle
    private let content: Content
    private let toolbar: Toolbar
    private let footer: Footer

    public init(
        _ title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder toolbar: () -> Toolbar,
        @ViewBuilder footer: () -> Footer
    ) {
        self.title = title
        self.subtitle = subtitle
        self.kicker = kicker
        self.headerStyle = headerStyle
        self.content = content()
        self.toolbar = toolbar()
        self.footer = footer()
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
        .background(theme.palette.canvas)
        .modifier(ScaffoldNavigation(style: headerStyle, title: title, toolbar: toolbar))
        .pinnedFooter(isPresented: Footer.self != EmptyView.self) { footer }
    }
}

extension ScreenScaffold where Footer == EmptyView {
    /// A screen with toolbar buttons and no footer.
    public init(
        _ title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder toolbar: () -> Toolbar
    ) {
        self.init(
            title,
            subtitle: subtitle,
            kicker: kicker,
            headerStyle: headerStyle,
            content: content,
            toolbar: toolbar,
            footer: { EmptyView() }
        )
    }
}

extension ScreenScaffold where Toolbar == EmptyView {
    /// A screen with a pinned footer and no toolbar buttons.
    public init(
        _ title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.init(
            title,
            subtitle: subtitle,
            kicker: kicker,
            headerStyle: headerStyle,
            content: content,
            toolbar: { EmptyView() },
            footer: footer
        )
    }
}

extension ScreenScaffold where Toolbar == EmptyView, Footer == EmptyView {
    /// A screen with only content.
    public init(
        _ title: String,
        subtitle: String? = nil,
        kicker: String? = nil,
        headerStyle: ScreenHeaderStyle = .navigationBar,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title,
            subtitle: subtitle,
            kicker: kicker,
            headerStyle: headerStyle,
            content: content,
            toolbar: { EmptyView() },
            footer: { EmptyView() }
        )
    }
}

/// The kicker, title (inline style only), subtitle and inline toolbar.
private struct ScaffoldHeader<Toolbar: View>: View {
    @Environment(\.craftTheme) private var theme
    let title: String
    let subtitle: String?
    let kicker: String?
    let showsTitle: Bool
    let toolbar: Toolbar

    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                if let kicker {
                    Text(kicker)
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.accentText)
                        .textCase(.uppercase)
                }
                if showsTitle {
                    Text(title)
                        .font(theme.font(.largeTitle))
                        .foregroundStyle(theme.palette.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                }
                if let subtitle {
                    Text(subtitle)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if showsTitle {
                HStack(spacing: Space.sm) { toolbar }
                    .buttonStyle(.glass)
                    .buttonBorderShape(.circle)
                    .labelStyle(.iconOnly)
            }
        }
        .padding(.top, showsTitle ? Space.lg : 0)
    }
}

/// Navigation title and toolbar for `.navigationBar`; nothing for `.inline`.
private struct ScaffoldNavigation<Toolbar: View>: ViewModifier {
    let style: ScreenHeaderStyle
    let title: String
    let toolbar: Toolbar

    func body(content: Content) -> some View {
        switch style {
        case .navigationBar:
            content
                .navigationTitle(title)
                #if os(iOS)
                    .navigationBarTitleDisplayMode(.large)
                #endif
                .toolbar {
                    ToolbarItemGroup(placement: .primaryAction) { toolbar }
                }
        case .inline:
            content
        }
    }
}

#if DEBUG
    private struct ScreenScaffoldPreview: View {
        let style: ScreenHeaderStyle

        var body: some View {
            ScreenScaffold("Week", subtitle: "3 of 4 workouts", kicker: "October", headerStyle: style) {
                ForEach(1..<12) { index in
                    Text("Card \(index)").craftCard()
                }
            } toolbar: {
                Button("Add workout", systemImage: "plus") {}
            } footer: {
                Button("Start workout") {}
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
