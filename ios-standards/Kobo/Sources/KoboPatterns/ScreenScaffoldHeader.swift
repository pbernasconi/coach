import KoboComponents
import KoboTokens
import SwiftUI

/// The kicker, title (inline style only), subtitle and inline toolbar.
struct ScaffoldHeader<Toolbar: View>: View {
    @Environment(\.koboTheme) private var theme
    let title: Text
    let subtitle: Text?
    let kicker: Text?
    let showsTitle: Bool
    let toolbar: Toolbar

    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                if let kicker {
                    kicker
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.accentText)
                }
                if showsTitle {
                    title
                        .font(theme.font(.largeTitle))
                        .foregroundStyle(theme.palette.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                }
                if let subtitle {
                    subtitle
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if showsTitle {
                HStack(spacing: Space.sm) { toolbar }
                    .modifier(InlineToolbarLook())
                    .labelStyle(.iconOnly)
            }
        }
        .padding(.top, showsTitle ? Space.lg : 0)
    }
}

/// Glass circles beside an inline title, in one `GlassEffectContainer`; flat Kobo circles under a `.solid` theme
/// (glass yields to `.solid`, CONVENTIONS rule 16).
private struct InlineToolbarLook: ViewModifier {
    @Environment(\.koboTheme) private var theme

    func body(content: Content) -> some View {
        switch theme.surfaceStyle {
        case .glass:
            GlassEffectContainer(spacing: Space.sm) {
                content.buttonStyle(.glass).buttonBorderShape(.circle)
            }
        case .solid:
            content.buttonStyle(.kobo(.secondary, size: .icon))
        }
    }
}

/// Navigation title and toolbar for `.navigationBar`; nothing for `.inline`.
struct ScaffoldNavigation<Toolbar: View>: ViewModifier {
    let style: ScreenHeaderStyle
    let title: Text
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

/// The title, subtitle and kicker of a `ScreenScaffold`, as ready-made texts.
struct ScaffoldTexts {
    let title: Text
    let subtitle: Text?
    let kicker: Text?

    init(_ title: LocalizedStringKey, subtitle: LocalizedStringKey?, kicker: LocalizedStringKey?) {
        self.title = Text(title)
        self.subtitle = subtitle.map { Text($0) }
        self.kicker = kicker.map { Text($0) }
    }

    init(verbatim title: String, subtitle: String?, kicker: String?) {
        self.title = Text(verbatim: title)
        self.subtitle = subtitle.map { Text(verbatim: $0) }
        self.kicker = kicker.map { Text(verbatim: $0) }
    }
}
